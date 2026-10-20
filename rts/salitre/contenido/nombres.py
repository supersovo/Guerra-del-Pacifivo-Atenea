"""Nombres de los veteranos: «Cabo Juan Soto, Atacama».

Cada veterano recibe una semilla al ascender (sim/veterania.semilla_nombre) y viaja
en las instantáneas; con datos/nombres.json, el servidor y todos los clientes la
convierten en el mismo nombre, grado y cuerpo según la nación y el arma.
"""

import json

from .. import rutas

_datos = None
FORMAS_MUJER = ("cantinera", "heroina")
NAVAL = "naval"


def _cargar():
    global _datos
    if _datos is None:
        try:
            _datos = json.loads((rutas.dir_datos() / "nombres.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            _datos = {"nombres": ["Juan"], "nombres_mujer": ["María"], "naciones": {}}
    return _datos


def _elegir(lista, semilla, sal):
    if not lista:
        return ""
    return lista[((semilla * 2654435761 + sal * 97) >> 7) % len(lista)]


def cuerpo(faccion_id, tipo, semilla):
    """El batallón, regimiento o cuerpo del veterano."""
    nac = _cargar()["naciones"].get(faccion_id, {})
    cuerpos = nac.get("cuerpos", {})
    lista = cuerpos.get(tipo.id) or cuerpos.get(tipo.clase) or cuerpos.get("infanteria", [])
    return _elegir(lista, semilla, 3)


def nombre(cat, faccion_id, tipo, grado, semilla, con_cuerpo=True):
    """«Cabo Juan Soto, Atacama» (o «Cañonera Covadonga» para un buque); "" sin semilla."""
    if not semilla:
        return ""
    d = _cargar()
    nac = d["naciones"].get(faccion_id, {})
    if tipo.clase == NAVAL:
        return f"{cat.nombre(faccion_id, tipo.id)} «{_elegir(nac.get('buques', ['Esperanza']), semilla, 5)}»"
    mujer = tipo.sprite.get("forma") in FORMAS_MUJER
    pila = _elegir(d["nombres_mujer"] if mujer else d["nombres"], semilla, 1)
    apellido = _elegir(nac.get("apellidos", ["Pérez"]), semilla, 2)
    vet = cat.veterania
    if mujer:
        rango = "Cantinera"
    else:
        rango = vet.grados[max(0, min(grado, vet.maximo))].rango
    texto = f"{rango} {pila} {apellido}"
    if con_cuerpo:
        c = cuerpo(faccion_id, tipo, semilla)
        if c:
            texto += f", {c}"
    return texto
