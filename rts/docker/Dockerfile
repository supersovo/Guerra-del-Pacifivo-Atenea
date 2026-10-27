# Servidor dedicado de «Guerra del Pacífico: Salitre y Pólvora».
# No necesita pygame ni pantalla: solo Python y los datos del juego.
#
#   cd rts
#   docker build -f docker/Dockerfile -t salitre-servidor .
#   docker run -d --name salitre -p 47800:47800 -v salitre-datos:/datos salitre-servidor
#
# Para que los jugadores de la misma red lo encuentren con «Buscar en la red
# local» (UDP 47801), use --network host en lugar de -p.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SALITRE_DATOS_USUARIO=/datos

RUN useradd --create-home --uid 1000 salitre \
    && mkdir -p /datos && chown salitre:salitre /datos

WORKDIR /juego
COPY salitre/ salitre/
COPY datos/ datos/
COPY mapas/ mapas/

USER salitre
VOLUME ["/datos"]
EXPOSE 47800/tcp 47801/udp

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import socket; socket.create_connection(('127.0.0.1', 47800), 3).close()"

ENTRYPOINT ["python", "-m", "salitre", "--servidor"]
CMD ["--nombre", "Servidor de Salitre y Pólvora"]
