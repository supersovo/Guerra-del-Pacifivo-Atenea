# Juego en red con los compañeros

Una partida en red necesita **un servidor** al que se conectan todos. El servidor
puede ser el mismo juego de uno de los jugadores («Crear servidor en este
equipo»), un computador que quede encendido con el **servidor dedicado** o una
máquina en la nube. Todos deben tener **la misma versión** del juego: al entrar se
comparan los datos y, si difieren, el servidor lo avisa.

## ¿Qué método elegir?

| Situación | Método | Dificultad |
|-----------|--------|------------|
| Todos en la misma red (sala de clases, laboratorio, casa) | [Red local](#1-misma-red-local) | Fácil |
| Cada uno en su casa | [Red privada virtual](#2-desde-casas-distintas-red-privada-virtual) (Radmin VPN, ZeroTier o Tailscale) | Fácil |
| Cada uno en su casa, sin instalar nada más | [Abrir el puerto en el router](#3-abrir-el-puerto-en-el-router) de quien hospeda | Media |
| Un servidor permanente para todo el curso, con escalafón | [Servidor dedicado](#4-servidor-dedicado) en un PC o en la nube (Docker) | Media |

Recomendación para un curso: **un servidor dedicado** (en un PC del laboratorio o
en la nube) con cuentas obligatorias (`--sin-invitados`). Así el escalafón y el
historial de cada alumno quedan en un solo lugar y las repeticiones de todas las
batallas se pueden estudiar después.

## 1. Misma red local

**Quien hospeda:**

1. *Multijugador en línea* → escriba su nombre.
2. Pulse **Crear servidor en este equipo**. El juego abre el servidor en el puerto
   47800 y muestra las direcciones IP del equipo (por ejemplo `192.168.1.20`).
3. Si Windows pregunta por el cortafuegos, permita el acceso en **redes
   privadas** (el instalador puede dejarlo configurado).
4. Ya en el *Cuartel general*, cree una sala, elija el mapa y espere a sus
   compañeros.

**Los demás:**

1. *Multijugador en línea* → escriban su nombre.
2. **Buscar en la red local**: el servidor aparece en la lista; doble clic.
3. Si no aparece, escriban la dirección que muestra el anfitrión
   (`192.168.1.20:47800`) y pulsen **Conectar**.
4. En el *Cuartel general*, doble clic en la sala; elijan nación, equipo y color, y
   marquen **Estoy listo**. El anfitrión da la orden **¡Iniciar el combate!**

También se puede abrir el juego directo hacia un servidor:
`GuerraDelPacifico.exe --conectar 192.168.1.20 --nombre Prat`.

> **Redes Wi-Fi de colegios y lugares públicos.** Muchas aíslan a los equipos
> entre sí («aislamiento de clientes»): la búsqueda no encuentra nada y la
> conexión directa tampoco funciona. En ese caso use un cable, un punto de acceso
> propio (por ejemplo, el teléfono de uno de ustedes) o una red privada virtual.

## 2. Desde casas distintas: red privada virtual

Una red privada virtual (VPN) junta los computadores de todos como si estuvieran
en la misma sala, sin tocar el router. Las tres más usadas para jugar tienen un
plan gratuito (revise los límites de usuarios de cada plan en su página):

| Programa | Sistemas | Cómo |
|----------|----------|------|
| **Radmin VPN** | Windows | Quien hospeda crea una red con nombre y clave; los demás se unen con esos datos. Cada equipo recibe una IP `26.x.x.x`. |
| **ZeroTier** | Windows, macOS, Linux, móviles | Se crea una red en el sitio de ZeroTier; cada uno se une con el identificador de red y el creador autoriza a los miembros. |
| **Tailscale** | Windows, macOS, Linux, móviles | Cada uno inicia sesión; el anfitrión invita a los demás a su red o comparte su equipo con ellos. Direcciones `100.x.y.z`. |

Después, quien hospeda pulsa **Crear servidor en este equipo** y los demás se
conectan a **la IP de la red privada** del anfitrión (no a la de su casa). La
búsqueda automática suele funcionar en Radmin VPN y ZeroTier; en Tailscale
escriba la IP. El tráfico va cifrado por la red privada.

## 3. Abrir el puerto en el router

1. Dé al equipo de quien hospeda una IP local fija (reserva DHCP en el router).
2. En el router, redirija el puerto **47800 TCP** hacia esa IP (*port forwarding* o
   «servidores virtuales»).
3. Averigüe la IP pública (por ejemplo, buscando «cuál es mi IP» en la web) y
   compártala: los demás se conectan a `IP_pública:47800`.

Si el proveedor de Internet usa **CGNAT** (frecuente en fibra y en redes móviles),
la redirección no funciona aunque esté bien configurada: use una red privada
virtual o un servidor en la nube.

## 4. Servidor dedicado

El servidor dedicado no necesita pantalla ni tarjeta de video. Una partida
grande ocupa unos pocos milisegundos de procesador por tick (16 por segundo), así
que un equipo modesto o la máquina virtual más pequeña de un proveedor de nube
atienden varias partidas a la vez.

### En un computador

Menú de inicio → **Servidor dedicado**, o desde una consola:

```sh
ServidorSalitre.exe --nombre "Curso 3º B" --sin-invitados
python -m salitre --servidor --nombre "Curso 3º B" --sin-invitados   # desde el código fuente
```

| Opción | Efecto |
|--------|--------|
| `--puerto 47800` | Puerto TCP (el de la búsqueda en red local es el 47801 UDP) |
| `--host 0.0.0.0` | Dirección donde escuchar (todas, por omisión) |
| `--nombre "..."` | Nombre que ven los jugadores |
| `--sin-invitados` | Exige cuenta con clave: todas las partidas cuentan para el escalafón |
| `--sin-lan` | No responde a la búsqueda en la red local |
| `--bd ruta.db` | Base de datos (por omisión, `servidor.db` en la carpeta de datos) |
| `--detallado` | Registro detallado |

### Con Docker (en la nube o en un servidor de la escuela)

```sh
cd rts
docker build -f docker/Dockerfile -t salitre-servidor .
docker run -d --name salitre --restart unless-stopped \
    -p 47800:47800 -v salitre-datos:/datos \
    salitre-servidor --nombre "Curso 3º B" --sin-invitados
```

o, con `docker compose`, `cd rts/docker && docker compose up -d`. Abra el puerto
**47800 TCP** en el cortafuegos del proveedor. Las cuentas, el escalafón y las
repeticiones quedan en el volumen `salitre-datos`; para respaldarlos, copie
`servidor.db` y la carpeta `repeticiones/` con el servidor detenido.

## Cuentas, escalafón y estadísticas

- **Invitado**: basta un nombre. Puede jugar, pero sus partidas no suman al
  escalafón.
- **Cuenta**: nombre y clave (mínimo 4 caracteres), marcando *Crear una cuenta
  nueva* la primera vez. La clave se guarda con PBKDF2-HMAC-SHA256 y sal.
- **Escalafón ELO**: todos parten con 1200. Cuentan las partidas entre al menos
  dos bandos con jugadores registrados que terminan con un vencedor; las
  partidas contra la IA no mueven el ELO.
- **Historial**: en el *Cuartel general*, pestaña *Mi historial*, con el
  resultado, la nación y el cambio de ELO de cada batalla.
- Las partidas de menos de 30 segundos no se registran.

## Durante la partida

- **El servidor manda**: cada cliente envía órdenes y recibe 8 instantáneas por
  segundo de lo que ve. La latencia aparece en la barra superior; por debajo de
  150 ms la partida se juega con fluidez.
- **Si se corta la conexión**: a los 20 segundos la IA toma el mando del ejército
  hasta que el jugador vuelva a entrar **con el mismo nombre** (y su clave). A los
  3 minutos sin volver, se le da por rendido. Si no queda ningún jugador
  conectado, la partida se cierra al minuto.
- **Espectadores**: desde el *Cuartel general*, *Observar* una partida en curso.
- **Conversación**: Intro para todos, Mayúsculas + Intro para el equipo; Alt + G
  marca un punto del mapa para los aliados.
- **Repeticiones**: el servidor guarda cada batalla. En el *parte de guerra*,
  **Guardar la repetición aquí** copia la batalla al equipo de cada jugador para
  verla en *Repeticiones* con todo el mapa a la vista.

## Seguridad

- El servidor valida cada orden y calcula la niebla de guerra: un cliente
  modificado no puede ver lo que su ejército no ve ni dar órdenes imposibles.
- Los mensajes son JSON con límites de tamaño y de frecuencia; no se usa ningún
  formato que ejecute código.
- La conexión del juego **no va cifrada**: use una clave exclusiva para el juego.
  Con una red privada virtual, el tráfico sí viaja cifrado.

## Solución de problemas

| Problema | Qué hacer |
|----------|-----------|
| «Los datos del juego no coinciden con los del servidor» | Todos deben instalar la misma versión. |
| La búsqueda en red local no encuentra el servidor | Escriba la IP del anfitrión; revise el cortafuegos y el aislamiento de clientes del Wi-Fi. |
| «No se pudo abrir el puerto 47800» | Ya hay un servidor abierto en ese equipo (por ejemplo, el dedicado). Conéctese a `127.0.0.1:47800`. |
| «Ese nombre pertenece a una cuenta registrada» | Escriba la clave de esa cuenta o use otro nombre. |
| «Se abrió otra sesión con su nombre» | Alguien entró con su nombre desde otro equipo. |
| Para probar si el puerto responde (Windows) | `Test-NetConnection 192.168.1.20 -Port 47800` en PowerShell. |
| Registros para pedir ayuda | `%APPDATA%\GuerraDelPacifico\registros\cliente.log` y `servidor.log`. |
