"""Serie de campaña en red: varias batallas seguidas en la misma sala, en las que cada
ejército conserva a sus veteranos de una batalla a la siguiente.

El servidor lleva el escalafón de cada jugador (y de cada IA) y lo guarda en su base
de datos después de cada batalla; los veteranos bajan del tren o de la carreta con el
cuartel general en la batalla siguiente. La nación y el equipo quedan fijos durante la
serie. Si un jugador se desconecta entre batallas, su lugar lo espera; el anfitrión
puede entregar ese ejército (con sus veteranos) a la IA.

Gana la serie el equipo con más batallas ganadas; si empatan, el de más honores (cada
victoria y cada veterano preservado suman, como en la campaña contra la IA).
"""

from ..contenido import campanas

MIN_BATALLAS = 2
MAX_BATALLAS = 4
# después de cada batalla la sala pasa al mapa siguiente de este itinerario que sirva
ITINERARIO = ["pampa_del_tamarugal", "quebrada_de_tarapaca", "alto_de_la_alianza", "morro_de_arica",
              "cuatro_naciones", "islas_de_chincha"]


class Serie:
    def __init__(self, total, ranuras, sid=None):
        self.id = sid
        self.total = max(MIN_BATALLAS, min(MAX_BATALLAS, int(total)))
        self.jugadas = 0
        self.terminada = False
        self.abandonada = False
        self.ganador = None
        self.historial = []
        self.reglas = campanas.Campana("serie", {})        # honores: los mismos de la campaña
        self.participantes = {}
        for k, r in enumerate(ranuras):
            if r["tipo"] not in ("humano", "ia"):
                continue
            ses = r.get("sesion")
            usuario = getattr(ses, "usuario", None) or {}
            self.participantes[k] = {
                "ranura": k, "nombre": r["nombre"], "es_ia": r["tipo"] == "ia", "faccion": r["faccion"],
                "equipo": r["equipo"], "usuario_id": usuario.get("id"), "victorias": 0, "honores": 0,
                "escalafon": [], "caidos": [], "contador": 0, "ultima": None,
            }

    @property
    def en_curso(self):
        return not self.terminada

    def veteranos(self, k):
        p = self.participantes.get(k)
        return [dict(v) for v in p["escalafon"]] if p else []

    def aplicar(self, cat, resultados, ganador, mapa_nombre, minutos):
        """Pasa el parte de una batalla a los escalafones. resultados: {ranura: resultado}."""
        self.jugadas += 1
        etiqueta = f"{self.jugadas}.ª batalla: {mapa_nombre}"
        for k, p in self.participantes.items():
            res = resultados.get(k)
            victoria = ganador is not None and p["equipo"] == ganador
            if res is None:
                p["ultima"] = {"victoria": victoria, "supervivientes": len(p["escalafon"]), "caidos": 0,
                               "nuevos": 0, "honores": 0}
                continue
            vivos, caidos, nuevos = campanas.actualizar_escalafon(cat, p, res, etiqueta)
            honores = (self.reglas.honor_victoria if victoria else 0) + self.reglas.honores_de(vivos)
            p["honores"] += honores
            if victoria:
                p["victorias"] += 1
            p["ultima"] = {"victoria": victoria, "supervivientes": len(vivos), "caidos": len(caidos),
                           "nuevos": nuevos, "honores": honores}
        self.historial.append({"mapa": mapa_nombre, "ganador": ganador, "minutos": round(float(minutos), 1)})
        if self.jugadas >= self.total:
            self.terminada = True
            self.ganador = self.ganador_de_la_serie()

    def marcador(self):
        """{equipo: [batallas ganadas, honores]}."""
        out = {}
        for p in self.participantes.values():
            out.setdefault(p["equipo"], [0, 0])[1] += p["honores"]
        for h in self.historial:
            if h["ganador"] in out:
                out[h["ganador"]][0] += 1
        return out

    def ganador_de_la_serie(self):
        m = self.marcador()
        if not m:
            return None
        orden = sorted(m.items(), key=lambda kv: (-kv[1][0], -kv[1][1]))
        if len(orden) > 1 and orden[0][1] == orden[1][1]:
            return None
        return orden[0][0]

    def proximo_mapa(self, actual, mapas, necesarios):
        """El mapa siguiente del itinerario con lugar para todos (o el actual)."""
        orden = [m for m in ITINERARIO if m in mapas] + sorted(m for m in mapas if m not in ITINERARIO)
        if actual in orden:
            k = orden.index(actual)
            orden = orden[k + 1:] + orden[:k + 1]
        for m in orden:
            if mapas[m] >= necesarios:
                return m
        return actual

    # ------------------------------------------------------------------
    def a_dict(self, cat=None):
        vet_max = cat.veterania.maximo if cat is not None else 3
        participantes = []
        for k in sorted(self.participantes):
            p = self.participantes[k]
            grados = [0] * vet_max
            for v in p["escalafon"]:
                g = max(1, min(vet_max, int(v.get("grado", 1))))
                grados[g - 1] += 1
            participantes.append({"ranura": k, "nombre": p["nombre"], "es_ia": p["es_ia"], "faccion": p["faccion"],
                                  "equipo": p["equipo"], "victorias": p["victorias"], "honores": p["honores"],
                                  "veteranos": len(p["escalafon"]), "grados": grados, "caidos": len(p["caidos"]),
                                  "ultima": p["ultima"]})
        return {"id": self.id, "total": self.total, "jugadas": self.jugadas, "terminada": self.terminada,
                "abandonada": self.abandonada, "ganador": self.ganador, "historial": list(self.historial),
                "marcador": {str(e): v for e, v in self.marcador().items()}, "participantes": participantes}

    def estado(self):
        """Todo lo que se guarda en la base de datos."""
        return {"total": self.total, "jugadas": self.jugadas, "terminada": self.terminada,
                "abandonada": self.abandonada, "ganador": self.ganador, "historial": self.historial,
                "participantes": {str(k): p for k, p in self.participantes.items()}}
