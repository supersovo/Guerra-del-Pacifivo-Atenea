"""Generador de números pseudoaleatorios determinista (xorshift64*).

No se usa el módulo random de Python para que la secuencia sea idéntica en
cualquier versión y plataforma: las repeticiones dependen de ello.
"""

_M64 = (1 << 64) - 1


class Azar:
    __slots__ = ("s",)

    def __init__(self, semilla):
        s = (int(semilla) * 0x9E3779B97F4A7C15 + 0xD1B54A32D192ED03) & _M64
        self.s = s or 0x2545F4914F6CDD1D

    def siguiente(self):
        x = self.s
        x ^= x >> 12
        x ^= (x << 25) & _M64
        x ^= x >> 27
        self.s = x
        return ((x * 0x2545F4914F6CDD1D) & _M64) >> 32

    def entero(self, n):
        """Entero en [0, n)."""
        if n <= 1:
            return 0
        return self.siguiente() % n

    def rango(self, a, b):
        """Entero en [a, b]."""
        return a + self.entero(b - a + 1)

    def prob(self, porcentaje):
        return self.entero(100) < porcentaje
