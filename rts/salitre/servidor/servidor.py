"""Servidor del juego: cuentas, salas de espera, chat y partidas autoritativas.

Una sola tarea asyncio atiende a todos los clientes; cada partida corre su
propio bucle de ticks (16 por segundo a velocidad normal) dentro del mismo
proceso. El servidor simula, decide y envía a cada jugador solo lo que ve.

Si un jugador pierde la conexión, a los 20 segundos la IA toma el mando de su
ejército hasta que vuelva (basta con conectarse de nuevo con el mismo nombre).
"""

import asyncio
import logging
import re
import secrets
import time

from .. import NOMBRE_JUEGO, PROTOCOLO, VERSION, rutas
from ..contenido import catalogo as mod_cat
from ..contenido import mapas as mod_mapas
from ..ia.ia import DIFICULTADES, IA
from ..red import protocolo as P
from ..red.instantanea import Emisor
from ..sim.constantes import TICKS
from ..sim.mundo import Mundo
from . import repeticion
from .bd import BaseDatos

log = logging.getLogger("salitre.servidor")

INSTANTANEA_CADA = 2          # ticks entre instantáneas (8 por segundo)
ESPERA_IA_TOMA = 20 * TICKS   # sin conexión: la IA toma el mando
ABANDONO = 180 * TICKS        # sin conexión: se rinde
ESPERA_TODOS_FUERA = 60 * TICKS   # si no queda nadie conectado, la partida se cierra
VELOCIDADES = {"normal": 1.0, "rapida": 1.25, "muy_rapida": 1.5}
NOMBRE_VALIDO = re.compile(r"^[\w áéíóúÁÉÍÓÚñÑüÜ.\-]{3,20}$")
COLORES_MAX = 8


class Sesion:
    def __init__(self, srv, reader, writer):
        self.srv = srv
        self.reader = reader
        self.writer = writer
        self.usuario = None
        self.nombre = None
        self.invitado = True
        self.sala = None
        self.partida = None
        self.indice = None
        self.cola = asyncio.Queue(maxsize=2000)
        self.vivo = True
        self.ritmo_chat = []
        self.ritmo_cmd = []
        pe = writer.get_extra_info("peername")
        self.direccion = f"{pe[0]}:{pe[1]}" if pe else "?"

    def enviar(self, msg, comprimir=None):
        if not self.vivo:
            return
        try:
            self.cola.put_nowait(P.codificar(msg, comprimir))
        except asyncio.QueueFull:
            log.warning("%s no da abasto: se le desconecta", self.nombre)
            self.cerrar()

    def error(self, texto):
        self.enviar({"t": "error", "msg": texto})

    def cerrar(self):
        if self.vivo:
            self.vivo = False
            try:
                self.cola.put_nowait(None)
            except asyncio.QueueFull:
                pass
            try:
                self.writer.close()
            except Exception:  # noqa: BLE001 - cerrar nunca debe fallar
                pass

    async def bucle_envio(self):
        try:
            while True:
                datos = await self.cola.get()
                if datos is None:
                    break
                self.writer.write(datos)
                await self.writer.drain()
        except (ConnectionError, OSError):
            pass
        finally:
            self.vivo = False

    def limite(self, lista, maximo, ventana=1.0):
        ahora = time.monotonic()
        while lista and ahora - lista[0] > ventana:
            lista.pop(0)
        if len(lista) >= maximo:
            return False
        lista.append(ahora)
        return True

    def resumen(self):
        u = self.usuario or {}
        return {"nombre": self.nombre, "elo": u.get("elo"), "invitado": self.invitado,
                "en_partida": self.partida is not None}


class Sala:
    def __init__(self, sid, nombre, mapa, anfitrion, velocidad="normal", clave=""):
        self.id = sid
        self.nombre = nombre
        self.mapa = mapa
        self.anfitrion = anfitrion
        self.velocidad = velocidad
        self.clave = clave
        self.estado = "espera"
        self.partida = None
        self.ranuras = [self._ranura_abierta(i) for i in range(mapa.jugadores)]
        self.ocupar(0, anfitrion)

    @staticmethod
    def _ranura_abierta(i):
        return {"tipo": "abierta", "sesion": None, "nombre": "", "faccion": "chile",
                "equipo": i + 1, "color": i, "listo": False, "dificultad": "normal"}

    def colores_libres(self):
        usados = {r["color"] for r in self.ranuras if r["tipo"] in ("humano", "ia")}
        return [c for c in range(COLORES_MAX) if c not in usados]

    def ocupar(self, i, sesion):
        r = self.ranuras[i]
        libres = self.colores_libres()
        r.update(tipo="humano", sesion=sesion, nombre=sesion.nombre, listo=False)
        if r["color"] not in libres and libres:
            r["color"] = libres[0]
        sesion.sala = self

    def indice_de(self, sesion):
        for i, r in enumerate(self.ranuras):
            if r["sesion"] is sesion:
                return i
        return None

    def humanos(self):
        return [r["sesion"] for r in self.ranuras if r["tipo"] == "humano" and r["sesion"] is not None]

    def a_dict(self):
        return {
            "id": self.id, "nombre": self.nombre, "mapa": self.mapa.id, "mapa_nombre": self.mapa.nombre,
            "anfitrion": self.anfitrion.nombre if self.anfitrion else "", "velocidad": self.velocidad,
            "estado": self.estado, "con_clave": bool(self.clave),
            "ranuras": [{"tipo": r["tipo"], "nombre": r["nombre"], "faccion": r["faccion"],
                         "equipo": r["equipo"], "color": r["color"], "listo": r["listo"],
                         "dificultad": r["dificultad"]} for r in self.ranuras],
            "ocupadas": sum(1 for r in self.ranuras if r["tipo"] in ("humano", "ia")),
        }


class Partida:
    def __init__(self, srv, sala=None, repeticion_datos=None, espectador=None, pid=None):
        self.srv = srv
        self.id = pid or srv.nuevo_id_partida()
        self.sala = sala
        self.inicio = time.time()
        self.cmds = []
        self.espectadores = []
        self.abortada = False
        self.terminada = False
        self.pausa = False
        self.repeticion = repeticion_datos
        self.k_rep = 0
        self.todos_fuera_t = None
        cat = srv.cat
        if repeticion_datos is not None:
            self.mapa = mod_mapas.MapaDatos(repeticion_datos["mapa"])
            self.configs = repeticion_datos["jugadores"]
            self.semilla = repeticion_datos["semilla"]
            self.velocidad = 1.0
        else:
            self.mapa = sala.mapa
            self.velocidad = VELOCIDADES.get(sala.velocidad, 1.0)
            self.semilla = secrets.randbelow(2 ** 31 - 1) + 1
            self.configs = []
        self.jugadores = []
        if repeticion_datos is None:
            for r in sala.ranuras:
                if r["tipo"] not in ("humano", "ia"):
                    continue
                idx = len(self.configs)
                s = r["sesion"]
                self.configs.append({"nombre": r["nombre"], "faccion": r["faccion"], "equipo": r["equipo"],
                                     "color": r["color"], "ia": r["tipo"] == "ia",
                                     "dificultad": r["dificultad"]})
                self.jugadores.append({
                    "indice": idx, "sesion": s, "nombre": r["nombre"],
                    "usuario_id": (s.usuario or {}).get("id") if s and not s.invitado else None,
                    "es_ia": r["tipo"] == "ia", "conectado": s is not None, "fuera_t": None,
                    "ia_suplente": None,
                })
        self.mundo = Mundo(cat, self.mapa, self.configs, self.semilla, registrar=repeticion_datos is None)
        self.ias = {}
        self.emisores = {}
        for j in self.jugadores:
            if j["es_ia"]:
                self.ias[j["indice"]] = IA(self.mundo, j["indice"], self.configs[j["indice"]].get("dificultad", "normal"))
            elif j["sesion"] is not None:
                self.emisores[j["indice"]] = Emisor(self.mundo, j["indice"])
                j["sesion"].partida = self
                j["sesion"].indice = j["indice"]
        if espectador is not None:
            self.agregar_espectador(espectador)
        self.tarea = None

    # ------------------------------------------------------------------
    def mensaje_inicio(self, indice):
        return {
            "t": "inicio", "partida": self.id, "mapa": self.mapa.a_dict(), "semilla": self.semilla,
            "jugadores": [{"nombre": c["nombre"], "faccion": c["faccion"], "equipo": c["equipo"],
                           "color": c["color"], "ia": c.get("ia", False)} for c in self.configs],
            "yo": indice, "ticks": TICKS, "velocidad": self.velocidad, "huella": self.srv.cat.huella,
            "cada": INSTANTANEA_CADA, "repeticion": self.repeticion is not None,
            "fin_rep": self.repeticion["fin"] if self.repeticion else None,
        }

    def iniciar(self):
        for j in self.jugadores:
            s = j["sesion"]
            if s is not None:
                s.enviar(self.mensaje_inicio(j["indice"]), comprimir=True)
        self.tarea = asyncio.get_running_loop().create_task(self.bucle())

    def agregar_espectador(self, sesion):
        em = Emisor(self.mundo, None)
        self.espectadores.append((sesion, em))
        sesion.partida = self
        sesion.indice = -1
        if self.tarea is not None:
            sesion.enviar(self.mensaje_inicio(-1), comprimir=True)

    def reconectar(self, sesion, indice):
        j = self.jugadores[indice]
        j["sesion"] = sesion
        j["conectado"] = True
        j["fuera_t"] = None
        if j["ia_suplente"] is not None:
            self.ias.pop(indice, None)
            j["ia_suplente"] = None
        sesion.partida = self
        sesion.indice = indice
        em = self.emisores.get(indice)
        if em is None:
            em = self.emisores[indice] = Emisor(self.mundo, indice)
        em.reiniciar()
        sesion.enviar(self.mensaje_inicio(indice), comprimir=True)
        self.avisar(f"{j['nombre']} volvió a la partida.")

    def desconectado(self, sesion):
        if sesion.indice == -1:
            self.espectadores = [(s, e) for (s, e) in self.espectadores if s is not sesion]
            return
        for j in self.jugadores:
            if j["sesion"] is sesion:
                j["sesion"] = None
                j["conectado"] = False
                j["fuera_t"] = self.mundo.tick
                self.avisar(f"{j['nombre']} perdió la conexión. La IA tomará su mando si no vuelve en 20 s.")

    def avisar(self, texto):
        for s in self.sesiones():
            s.enviar({"t": "aviso", "msg": texto})

    def sesiones(self):
        out = [j["sesion"] for j in self.jugadores if j["sesion"] is not None]
        out += [s for (s, _e) in self.espectadores]
        return out

    def comando(self, sesion, cmd):
        if self.repeticion is not None or sesion.indice is None or sesion.indice < 0:
            return
        if not isinstance(cmd, dict) or not isinstance(cmd.get("c"), str):
            return
        if not sesion.limite(sesion.ritmo_cmd, 40):
            return
        self.cmds.append((sesion.indice, cmd))

    def chat(self, sesion, texto, canal):
        if sesion.indice is not None and sesion.indice >= 0:
            yo = self.mundo.jugadores[sesion.indice]
            destino = []
            for j in self.jugadores:
                s = j["sesion"]
                if s is None:
                    continue
                if canal == "equipo" and self.mundo.jugadores[j["indice"]].equipo != yo.equipo:
                    continue
                destino.append(s)
            destino += [s for (s, _e) in self.espectadores]
        else:
            destino = self.sesiones()
        msg = {"t": "chat", "de": sesion.nombre, "texto": texto, "canal": canal,
               "color": self.configs[sesion.indice]["color"] if sesion.indice is not None and sesion.indice >= 0 else -1}
        for s in destino:
            s.enviar(msg)

    # ------------------------------------------------------------------
    async def bucle(self):
        loop = asyncio.get_running_loop()
        m = self.mundo
        siguiente = loop.time()
        try:
            while not m.terminado and not self.abortada:
                if self.pausa:
                    await asyncio.sleep(0.1)
                    siguiente = loop.time()
                    continue
                if self.repeticion is not None:
                    coms = self.repeticion["comandos"]
                    while self.k_rep < len(coms) and coms[self.k_rep][0] <= m.tick + 1:
                        _t, p, c = coms[self.k_rep]
                        m.comando(p, c)
                        self.k_rep += 1
                    if m.tick >= self.repeticion["fin"]:
                        break
                else:
                    for i, c in self.cmds:
                        m.comando(i, c)
                    self.cmds.clear()
                    for i, ia in list(self.ias.items()):
                        try:
                            ia.actualizar()
                        except Exception:  # noqa: BLE001 - un error de la IA no debe tumbar la partida
                            log.exception("Error en la IA del jugador %s; queda desactivada", i)
                            self.ias.pop(i, None)
                m.paso()
                for em in self.emisores.values():
                    em.acumular()
                for _s, em in self.espectadores:
                    em.acumular()
                if m.tick % INSTANTANEA_CADA == 0 or m.terminado:
                    self._enviar_instantaneas()
                if m.tick % TICKS == 0 and self.repeticion is None:
                    self._revisar_conexiones()
                siguiente += 1.0 / (TICKS * self.velocidad)
                espera = siguiente - loop.time()
                if espera < -0.5:
                    siguiente = loop.time()
                    espera = 0
                await asyncio.sleep(max(0.0, espera))
        except asyncio.CancelledError:
            self.abortada = True
            raise
        except Exception:  # noqa: BLE001
            log.exception("La partida %s falló", self.id)
            self.abortada = True
        finally:
            self._enviar_instantaneas()
            await self.finalizar()

    def _enviar_instantaneas(self):
        for j in self.jugadores:
            s = j["sesion"]
            em = self.emisores.get(j["indice"])
            if s is not None and em is not None:
                s.enviar(em.construir())
        for s, em in self.espectadores:
            s.enviar(em.construir())

    def _revisar_conexiones(self):
        m = self.mundo
        humanos_conectados = 0
        for j in self.jugadores:
            if j["es_ia"]:
                continue
            if j["conectado"]:
                humanos_conectados += 1
                continue
            if not m.jugadores[j["indice"]].vivo:
                continue
            fuera = m.tick - (j["fuera_t"] or m.tick)
            if fuera >= ESPERA_IA_TOMA and j["ia_suplente"] is None:
                j["ia_suplente"] = IA(m, j["indice"], "normal")
                self.ias[j["indice"]] = j["ia_suplente"]
                self.avisar(f"La IA toma el mando del ejército de {j['nombre']} hasta que vuelva.")
            if fuera >= ABANDONO:
                m.comando(j["indice"], {"c": "rendirse"})
                j["fuera_t"] = None
                j["conectado"] = True   # ya no se le espera
                self.avisar(f"{j['nombre']} abandonó la partida.")
        if humanos_conectados == 0 and not self.espectadores:
            # todos se fueron: se espera un minuto por si vuelven, y luego se cierra
            if self.todos_fuera_t is None:
                self.todos_fuera_t = m.tick
            elif m.tick - self.todos_fuera_t >= ESPERA_TODOS_FUERA:
                self.abortada = True
        else:
            self.todos_fuera_t = None

    async def finalizar(self):
        if self.terminada:
            return
        self.terminada = True
        m = self.mundo
        fin = time.time()
        ganador = m.ganador if m.terminado else None
        resultados = []
        for i, j in enumerate(m.jugadores):
            info = self.jugadores[i] if i < len(self.jugadores) else {}
            resultados.append({
                "indice": i, "nombre": j.nombre, "faccion": j.faccion.id, "equipo": j.equipo,
                "es_ia": j.es_ia, "usuario_id": info.get("usuario_id"), "est": dict(j.est),
                "vivo": j.vivo,
            })
        nombre_rep = None
        elos = {}
        if self.repeticion is None and m.tick >= self.srv.minimo_registro:
            try:
                ruta = repeticion.guardar(m, self.configs, ganador)
                nombre_rep = ruta.name
            except OSError:
                log.exception("No se pudo guardar la repetición")
            if not self.abortada:
                try:
                    pid = self.srv.bd.registrar_partida(
                        self.mapa.id, self.inicio, fin, m.tick, self.semilla, VERSION, ganador,
                        [{"indice": r["indice"], "usuario_id": r["usuario_id"], "nombre": r["nombre"],
                          "faccion": r["faccion"], "equipo": r["equipo"], "es_ia": r["es_ia"],
                          "est": r["est"]} for r in resultados], nombre_rep)
                    d = self.srv.bd.partida(pid)
                    for pj in d["jugadores"]:
                        if pj["usuario_id"]:
                            elos[pj["indice"]] = [pj["elo_antes"], pj["elo_despues"]]
                except Exception:  # noqa: BLE001
                    log.exception("No se pudo registrar la partida en la base de datos")
        msg = {"t": "fin", "ganador": ganador, "abortada": self.abortada, "ticks": m.tick,
               "resultados": [{k: v for k, v in r.items() if k != "usuario_id"} for r in resultados],
               "elo": elos, "repeticion": nombre_rep}
        for s in self.sesiones():
            s.enviar(msg)
            s.partida = None
            s.indice = None
        self.srv.partida_terminada(self)


class Servidor:
    def __init__(self, host="0.0.0.0", puerto=P.PUERTO, ruta_bd=None, nombre="Servidor de Salitre y Pólvora",
                 invitados=True, lan=True, local=False, catalogo=None, minimo_registro=TICKS * 30):
        self.minimo_registro = minimo_registro   # partidas más cortas no se registran
        self.host = host
        self.puerto = puerto
        self.nombre = nombre
        self.invitados = invitados
        self.lan = lan
        self.local = local
        self.cat = catalogo or mod_cat.cargar()
        self.bd = BaseDatos(ruta_bd if ruta_bd is not None else rutas.ruta_bd_servidor())
        self.sesiones = set()
        self.salas = {}
        self.partidas = {}
        self._sig_sala = 1
        self._sig_partida = int(time.time()) % 100000
        self.server = None
        self.transporte_lan = None
        self.listo = asyncio.Event()

    def nuevo_id_partida(self):
        self._sig_partida += 1
        return self._sig_partida

    def info_publica(self):
        return {"juego": NOMBRE_JUEGO, "nombre": self.nombre, "puerto": self.puerto, "version": VERSION,
                "huella": self.cat.huella, "jugadores": len(self.sesiones), "salas": len(self.salas)}

    def mapas_disponibles(self):
        out = []
        for ident, ruta in mod_mapas.listar().items():
            try:
                d = mod_mapas.cargar(ruta)
            except mod_mapas.MapaError:
                continue
            out.append({"id": ident, "nombre": d.nombre, "jugadores": d.jugadores, "ancho": d.ancho,
                        "alto": d.alto, "descripcion": d.descripcion, "naval": d.naval})
        return out

    # ------------------------------------------------------------------
    async def iniciar(self):
        self.server = await asyncio.start_server(self._conexion, self.host, self.puerto)
        self.puerto = self.server.sockets[0].getsockname()[1]
        if self.lan:
            try:
                from .descubrimiento import iniciar_respondedor
                self.transporte_lan = await iniciar_respondedor(self)
            except OSError as e:
                log.warning("Sin descubrimiento en red local: %s", e)
        log.info("%s escuchando en %s:%s", self.nombre, self.host, self.puerto)
        self.listo.set()

    async def servir(self):
        await self.iniciar()
        async with self.server:
            await self.server.serve_forever()

    async def cerrar(self):
        for p in list(self.partidas.values()):
            if p.tarea is not None:
                p.tarea.cancel()
        for s in list(self.sesiones):
            s.cerrar()
        if self.transporte_lan is not None:
            self.transporte_lan.close()
        if self.server is not None:
            self.server.close()
            try:
                await asyncio.wait_for(self.server.wait_closed(), 2)
            except asyncio.TimeoutError:
                pass
        self.bd.cerrar()

    # ------------------------------------------------------------------
    async def _conexion(self, reader, writer):
        s = Sesion(self, reader, writer)
        self.sesiones.add(s)
        envio = asyncio.get_running_loop().create_task(s.bucle_envio())
        try:
            msg = await asyncio.wait_for(P.leer(reader, P.MAX_MENSAJE_CLIENTE), 15)
            if msg.get("t") != "hola" or not await self._saludo(s, msg):
                await asyncio.sleep(0.2)
                return
            while s.vivo:
                msg = await P.leer(reader, P.MAX_MENSAJE_CLIENTE)
                try:
                    self._despachar(s, msg)
                except Exception:  # noqa: BLE001 - un mensaje malo no debe tumbar el servidor
                    log.exception("Error al atender %s de %s", msg.get("t"), s.nombre)
                    s.error("El servidor no pudo procesar la solicitud.")
        except (asyncio.IncompleteReadError, ConnectionError, OSError, asyncio.TimeoutError):
            pass
        except P.ErrorProtocolo as e:
            log.info("Protocolo inválido de %s: %s", s.direccion, e)
        finally:
            self._salida(s)
            s.cerrar()
            envio.cancel()

    async def _saludo(self, s, msg):
        if msg.get("protocolo") != PROTOCOLO:
            s.error(f"Versión de protocolo incompatible (servidor {PROTOCOLO}). Actualice el juego.")
            return False
        if msg.get("huella") != self.cat.huella:
            s.error("Los datos del juego no coinciden con los del servidor (versiones distintas). "
                    f"Servidor: {VERSION}.")
            return False
        nombre = P.texto(msg.get("nombre"), 20)
        clave = msg.get("clave") or ""
        if not isinstance(clave, str) or len(clave) > 100:
            s.error("Clave inválida.")
            return False
        if not NOMBRE_VALIDO.match(nombre or ""):
            s.error("El nombre debe tener entre 3 y 20 letras, números o espacios.")
            return False
        usuario = None
        invitado = True
        if self.local:
            invitado = True
        elif msg.get("registrar"):
            if len(clave) < 4:
                s.error("La clave debe tener al menos 4 caracteres.")
                return False
            usuario = await asyncio.to_thread(self.bd.crear_usuario, nombre, clave)
            if usuario is None:
                s.error("Ese nombre ya está registrado. Elija otro o ingrese con su clave.")
                return False
            invitado = False
        elif clave:
            usuario = await asyncio.to_thread(self.bd.verificar, nombre, clave)
            if usuario is None:
                s.error("Nombre o clave incorrectos.")
                return False
            invitado = False
        else:
            if not self.invitados:
                s.error("Este servidor exige cuenta: regístrese con una clave.")
                return False
            if self.bd.usuario(nombre) is not None:
                s.error("Ese nombre pertenece a una cuenta registrada: ingrese su clave.")
                return False
        # una misma persona no puede estar conectada dos veces: la sesión nueva reemplaza a la vieja
        for otra in list(self.sesiones):
            if otra is not s and otra.nombre and otra.nombre.lower() == nombre.lower():
                otra.error("Se abrió otra sesión con su nombre.")
                self._salida(otra)
                otra.cerrar()
        s.nombre = nombre
        s.usuario = usuario
        s.invitado = invitado
        s.enviar({
            "t": "bienvenida", "servidor": self.nombre, "version": VERSION, "nombre": nombre,
            "invitado": invitado, "usuario": {k: usuario[k] for k in ("elo", "partidas", "victorias", "derrotas")}
            if usuario else None,
            "mapas": self.mapas_disponibles(),
            "dificultades": {k: v["nombre"] for k, v in DIFICULTADES.items()},
            "velocidades": list(VELOCIDADES),
        })
        log.info("Ingresa %s desde %s%s", nombre, s.direccion, " (invitado)" if invitado else "")
        if not self._reanudar(s):
            self._difundir_lobby()
        return True

    def _reanudar(self, s):
        for p in self.partidas.values():
            if p.repeticion is not None:
                continue
            for j in p.jugadores:
                if not j["es_ia"] and not j["conectado"] and j["nombre"].lower() == s.nombre.lower():
                    p.reconectar(s, j["indice"])
                    if p.sala is not None:
                        i = None
                        for k, r in enumerate(p.sala.ranuras):
                            if r["tipo"] == "humano" and r["nombre"].lower() == s.nombre.lower():
                                i = k
                        if i is not None:
                            p.sala.ranuras[i]["sesion"] = s
                            s.sala = p.sala
                    return True
        return False

    def _salida(self, s):
        if s not in self.sesiones:
            return
        self.sesiones.discard(s)
        if s.partida is not None:
            s.partida.desconectado(s)
        if s.sala is not None:
            sala = s.sala
            if sala.estado == "espera":
                self._dejar_sala(s)
            else:
                i = sala.indice_de(s)
                if i is not None:
                    sala.ranuras[i]["sesion"] = None
        self._difundir_lobby()
        if s.nombre:
            log.info("Sale %s", s.nombre)

    # ------------------------------------------------------------------
    def _despachar(self, s, msg):
        t = msg["t"]
        f = getattr(self, "m_" + t, None)
        if f is None:
            s.error(f"Mensaje desconocido: {t}")
            return
        f(s, msg)

    def m_ping(self, s, msg):
        s.enviar({"t": "pong", "c": msg.get("c")})

    def m_salas(self, s, msg):
        s.enviar(self._estado_lobby())

    def m_escalafon(self, s, msg):
        s.enviar({"t": "escalafon", "filas": self.bd.escalafon(30)})

    def m_historial(self, s, msg):
        if s.usuario is None:
            s.enviar({"t": "historial", "filas": []})
            return
        s.enviar({"t": "historial", "filas": self.bd.historial(s.usuario["id"], 30)})

    def m_chat(self, s, msg):
        texto = P.texto(msg.get("texto"), 240)
        if not texto or not s.limite(s.ritmo_chat, 4):
            return
        canal = msg.get("canal", "sala")
        if s.partida is not None:
            s.partida.chat(s, texto, "equipo" if canal == "equipo" else "todos")
            return
        if s.sala is not None and canal == "sala":
            destino = s.sala.humanos()
        else:
            destino = [o for o in self.sesiones if o.partida is None and o.nombre]
            canal = "general"
        for o in destino:
            o.enviar({"t": "chat", "de": s.nombre, "texto": texto, "canal": canal})

    # -- salas -----------------------------------------------------------
    def m_crear_sala(self, s, msg):
        if s.partida is not None or s.sala is not None:
            s.error("Ya está en una sala.")
            return
        if len(self.salas) >= 50:
            s.error("Hay demasiadas salas abiertas.")
            return
        try:
            mapa = mod_mapas.buscar(P.texto(msg.get("mapa"), 60))
        except mod_mapas.MapaError as e:
            s.error(str(e))
            return
        nombre = P.texto(msg.get("nombre"), 40) or f"Sala de {s.nombre}"
        vel = msg.get("velocidad") if msg.get("velocidad") in VELOCIDADES else "normal"
        sala = Sala(self._sig_sala, nombre, mapa, s, vel, P.texto(msg.get("clave"), 30))
        self._sig_sala += 1
        self.salas[sala.id] = sala
        fac = msg.get("faccion")
        if fac in self.cat.facciones:
            sala.ranuras[0]["faccion"] = fac
        self._difundir_sala(sala)
        self._difundir_lobby()

    def m_unirse(self, s, msg):
        if s.partida is not None or s.sala is not None:
            s.error("Ya está en una sala.")
            return
        sala = self.salas.get(P.entero(msg.get("sala")))
        if sala is None or sala.estado != "espera":
            s.error("La sala no existe o ya está en combate.")
            return
        if sala.clave and P.texto(msg.get("clave"), 30) != sala.clave:
            s.error("Clave de sala incorrecta.")
            return
        for i, r in enumerate(sala.ranuras):
            if r["tipo"] == "abierta":
                sala.ocupar(i, s)
                self._difundir_sala(sala)
                self._difundir_lobby()
                return
        s.error("La sala está completa.")

    def m_salir_sala(self, s, msg):
        if s.sala is not None and s.sala.estado == "espera":
            self._dejar_sala(s)
            self._difundir_lobby()
            s.enviar(self._estado_lobby())

    def _dejar_sala(self, s):
        sala = s.sala
        s.sala = None
        if sala is None:
            return
        i = sala.indice_de(s)
        if i is not None:
            sala.ranuras[i] = Sala._ranura_abierta(i) | {"equipo": sala.ranuras[i]["equipo"]}
        if sala.anfitrion is s:
            humanos = sala.humanos()
            if humanos:
                sala.anfitrion = humanos[0]
            else:
                self.salas.pop(sala.id, None)
                return
        self._difundir_sala(sala)

    def _es_anfitrion(self, s):
        if s.sala is None or s.sala.anfitrion is not s or s.sala.estado != "espera":
            s.error("Solo el anfitrión de la sala puede hacer eso.")
            return False
        return True

    def m_ajustar(self, s, msg):
        sala = s.sala
        if sala is None or sala.estado != "espera":
            return
        k = msg.get("ranura")
        if k is None:
            k = sala.indice_de(s)
        else:
            k = P.entero(k, -1)
            if not (0 <= k < len(sala.ranuras)):
                return
            if sala.ranuras[k]["sesion"] is not s and not (sala.anfitrion is s and sala.ranuras[k]["tipo"] == "ia"):
                s.error("No puede cambiar la ranura de otro jugador.")
                return
        r = sala.ranuras[k]
        if "faccion" in msg and msg["faccion"] in self.cat.facciones:
            r["faccion"] = msg["faccion"]
        if "equipo" in msg:
            r["equipo"] = P.entero(msg["equipo"], r["equipo"], 1, 8)
        if "color" in msg:
            c = P.entero(msg["color"], r["color"], 0, COLORES_MAX - 1)
            if c in sala.colores_libres() or c == r["color"]:
                r["color"] = c
        if "dificultad" in msg and msg["dificultad"] in DIFICULTADES and r["tipo"] == "ia":
            r["dificultad"] = msg["dificultad"]
        if "listo" in msg and r["sesion"] is s:
            r["listo"] = bool(msg["listo"])
        else:
            if r["tipo"] == "humano" and r["sesion"] is not sala.anfitrion:
                r["listo"] = False if any(x in msg for x in ("faccion", "equipo", "color")) else r["listo"]
        self._difundir_sala(sala)

    def m_listo(self, s, msg):
        self.m_ajustar(s, {"listo": bool(msg.get("valor", True))})

    def m_agregar_ia(self, s, msg):
        if not self._es_anfitrion(s):
            return
        sala = s.sala
        for i, r in enumerate(sala.ranuras):
            if r["tipo"] == "abierta":
                libres = sala.colores_libres()
                fac = msg.get("faccion") if msg.get("faccion") in self.cat.facciones else "peru"
                dif = msg.get("dificultad") if msg.get("dificultad") in DIFICULTADES else "normal"
                r.update(tipo="ia", sesion=None, nombre=f"IA ({DIFICULTADES[dif]['nombre']})", faccion=fac,
                         dificultad=dif, listo=True, color=libres[0] if libres else r["color"])
                self._difundir_sala(sala)
                self._difundir_lobby()
                return
        s.error("No quedan ranuras libres.")

    def m_quitar(self, s, msg):
        if not self._es_anfitrion(s):
            return
        sala = s.sala
        k = P.entero(msg.get("ranura"), -1)
        if not (0 <= k < len(sala.ranuras)) or k == sala.indice_de(s):
            return
        r = sala.ranuras[k]
        if r["tipo"] == "humano" and r["sesion"] is not None:
            otro = r["sesion"]
            otro.sala = None
            otro.enviar({"t": "expulsado", "msg": "El anfitrión lo retiró de la sala."})
            otro.enviar(self._estado_lobby())
        if r["tipo"] == "cerrada":
            sala.ranuras[k] = Sala._ranura_abierta(k)
        elif r["tipo"] == "abierta":
            sala.ranuras[k]["tipo"] = "cerrada"
        else:
            sala.ranuras[k] = Sala._ranura_abierta(k)
        self._difundir_sala(sala)
        self._difundir_lobby()

    def m_mapa(self, s, msg):
        if not self._es_anfitrion(s):
            return
        sala = s.sala
        try:
            mapa = mod_mapas.buscar(P.texto(msg.get("mapa"), 60))
        except mod_mapas.MapaError as e:
            s.error(str(e))
            return
        viejas = sala.ranuras
        sala.mapa = mapa
        nuevas = []
        for i in range(mapa.jugadores):
            nuevas.append(viejas[i] if i < len(viejas) else Sala._ranura_abierta(i))
        for r in viejas[mapa.jugadores:]:
            if r["tipo"] == "humano" and r["sesion"] is not None:
                r["sesion"].sala = None
                r["sesion"].enviar({"t": "expulsado", "msg": "El nuevo mapa tiene menos lugares."})
                r["sesion"].enviar(self._estado_lobby())
        sala.ranuras = nuevas
        for r in sala.ranuras:
            if r["tipo"] == "humano" and r["sesion"] is not s:
                r["listo"] = False
        if "velocidad" in msg and msg["velocidad"] in VELOCIDADES:
            sala.velocidad = msg["velocidad"]
        self._difundir_sala(sala)
        self._difundir_lobby()

    def m_iniciar(self, s, msg):
        if not self._es_anfitrion(s):
            return
        sala = s.sala
        activas = [r for r in sala.ranuras if r["tipo"] in ("humano", "ia")]
        if len(activas) < 2:
            s.error("Hacen falta al menos dos bandos (agregue un jugador o la IA).")
            return
        if len({r["equipo"] for r in activas}) < 2:
            s.error("Todos están en el mismo equipo: elija equipos distintos.")
            return
        for r in activas:
            if r["tipo"] == "humano" and r["sesion"] is not s and not r["listo"]:
                s.error(f"{r['nombre']} todavía no está listo.")
                return
        sala.estado = "jugando"
        p = Partida(self, sala)
        sala.partida = p
        self.partidas[p.id] = p
        p.iniciar()
        self._difundir_lobby()
        log.info("Comienza la partida %s en %s con %s", p.id, sala.mapa.nombre,
                 ", ".join(r["nombre"] for r in activas))

    def m_partida_rapida(self, s, msg):
        """Atajo para el modo de un jugador: sala con la IA y comienzo inmediato."""
        if s.partida is not None:
            return
        if s.sala is not None:
            self._dejar_sala(s)
        self.m_crear_sala(s, {"mapa": msg.get("mapa"), "nombre": "Escaramuza", "faccion": msg.get("faccion"),
                              "velocidad": msg.get("velocidad", "normal")})
        sala = s.sala
        if sala is None:
            return
        rivales = msg.get("rivales") or [{"faccion": "peru", "dificultad": "normal"}]
        sala.ranuras[0]["equipo"] = 1
        for k, riv in enumerate(rivales[: len(sala.ranuras) - 1]):
            self.m_agregar_ia(s, riv)
            r = sala.ranuras[k + 1]
            r["equipo"] = P.entero(riv.get("equipo"), 2, 1, 8)
        self.m_iniciar(s, {})

    def m_cmd(self, s, msg):
        if s.partida is not None:
            s.partida.comando(s, msg.get("cmd"))

    def m_rendirse(self, s, msg):
        if s.partida is not None:
            s.partida.comando(s, {"c": "rendirse"})

    def m_abandonar(self, s, msg):
        p = s.partida
        if p is None:
            return
        if p.repeticion is not None or s.indice == -1:
            p.desconectado(s)
            s.partida = None
            s.indice = None
            if p.repeticion is not None:
                p.abortada = True
            s.enviar(self._estado_lobby())
            return
        p.comando(s, {"c": "rendirse"})
        p.desconectado(s)
        for j in p.jugadores:
            if j["sesion"] is None and j["nombre"] == s.nombre:
                j["conectado"] = True   # se fue por su voluntad: no se espera su regreso
        s.partida = None
        s.indice = None
        if s.sala is not None:
            i = s.sala.indice_de(s)
            if i is not None:
                s.sala.ranuras[i]["sesion"] = None
            s.sala = None
        s.enviar(self._estado_lobby())

    def m_observar(self, s, msg):
        p = self.partidas.get(P.entero(msg.get("partida")))
        if p is None or s.partida is not None or p.repeticion is not None:
            s.error("No se puede observar esa partida.")
            return
        p.agregar_espectador(s)
        s.enviar(p.mensaje_inicio(-1), comprimir=True)

    def m_pausa(self, s, msg):
        p = s.partida
        if p is None:
            return
        if p.repeticion is not None or self.local:
            p.pausa = bool(msg.get("valor", not p.pausa))
            for o in p.sesiones():
                o.enviar({"t": "pausa", "valor": p.pausa, "de": s.nombre})

    def m_velocidad_rep(self, s, msg):
        p = s.partida
        if p is not None and p.repeticion is not None:
            try:
                v = float(msg.get("valor", 1))
            except (TypeError, ValueError):
                return
            p.velocidad = max(0.25, min(8.0, v))

    def m_ver_repeticion(self, s, msg):
        """Reproduce una repetición guardada en este equipo (solo servidores locales)."""
        if not self.local or s.partida is not None:
            s.error("Las repeticiones se ven en el modo local.")
            return
        ruta = rutas.dir_repeticiones() / (P.texto(msg.get("nombre"), 120) + repeticion.EXTENSION)
        try:
            datos = repeticion.cargar(ruta)
        except (OSError, ValueError) as e:
            s.error(f"No se pudo abrir la repetición: {e}")
            return
        if datos.get("huella") != self.cat.huella:
            s.error("La repetición es de otra versión del juego.")
            return
        p = Partida(self, repeticion_datos=datos)
        self.partidas[p.id] = p
        p.agregar_espectador(s)
        p.iniciar()
        s.enviar(p.mensaje_inicio(-1), comprimir=True)

    # ------------------------------------------------------------------
    def partida_terminada(self, p):
        self.partidas.pop(p.id, None)
        sala = p.sala
        if sala is not None:
            sala.estado = "espera"
            sala.partida = None
            for i, r in enumerate(sala.ranuras):
                if r["tipo"] == "humano":
                    if r["sesion"] is None or not r["sesion"].vivo:
                        sala.ranuras[i] = Sala._ranura_abierta(i)
                    else:
                        r["listo"] = False
                        r["sesion"].sala = sala
            humanos = sala.humanos()
            if not humanos:
                self.salas.pop(sala.id, None)
            else:
                if sala.anfitrion not in humanos:
                    sala.anfitrion = humanos[0]
                self._difundir_sala(sala)
        self._difundir_lobby()

    def _estado_lobby(self):
        return {"t": "lobby",
                "salas": [sala.a_dict() for sala in self.salas.values()],
                "conectados": [s.resumen() for s in self.sesiones if s.nombre],
                "partidas": [{"id": p.id, "mapa": p.mapa.nombre,
                              "jugadores": [c["nombre"] for c in p.configs], "minutos": p.mundo.tick // (TICKS * 60)}
                             for p in self.partidas.values() if p.repeticion is None]}

    def _difundir_lobby(self):
        msg = self._estado_lobby()
        for s in self.sesiones:
            if s.nombre and s.partida is None:
                s.enviar(msg)

    def _difundir_sala(self, sala):
        d = sala.a_dict()
        for k, r in enumerate(sala.ranuras):
            ses = r["sesion"]
            if ses is not None:
                ses.enviar({"t": "sala", "sala": d, "yo": k, "anfitrion": sala.anfitrion is ses})


class ServidorEnHilo:
    """Servidor en un hilo aparte (modo de un jugador o para invitar a los amigos)."""

    def __init__(self, **opciones):
        import threading
        self.opciones = opciones
        self.servidor = None
        self.loop = None
        self.error = None
        self._listo = threading.Event()
        self.hilo = threading.Thread(target=self._correr, name="servidor-salitre", daemon=True)

    def _correr(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        try:
            self.servidor = Servidor(**self.opciones)
            self.loop.run_until_complete(self.servidor.iniciar())
        except Exception as e:  # noqa: BLE001
            self.error = e
            self._listo.set()
            return
        self._listo.set()
        try:
            self.loop.run_forever()
        finally:
            self.loop.run_until_complete(self.servidor.cerrar())
            self.loop.close()

    def iniciar(self, espera=10):
        self.hilo.start()
        self._listo.wait(espera)
        if self.error is not None:
            raise self.error
        return self.servidor.puerto

    def detener(self):
        if self.loop is not None and self.loop.is_running():
            self.loop.call_soon_threadsafe(self.loop.stop)
            self.hilo.join(5)
