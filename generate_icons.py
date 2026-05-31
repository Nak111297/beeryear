#!/usr/bin/env python3
"""Genera los iconos PNG del PWA con la paleta de Beer Year (Python puro)."""
import struct
import zlib

# Paleta (RGB)
BG = (16, 35, 29)        # verde lupulo oscuro
GLASS = (245, 159, 0)    # ambar lager
GLASS_HI = (255, 196, 70)
FOAM = (255, 250, 235)   # espuma
BUBBLE = (255, 226, 150)


def rounded(px, py, x0, y0, x1, y1, r):
    if px < x0 or px > x1 or py < y0 or py > y1:
        return False
    cx = min(max(px, x0 + r), x1 - r)
    cy = min(max(py, y0 + r), y1 - r)
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r


def make_icon(n):
    buf = bytearray()
    gx0, gx1 = 0.30 * n, 0.66 * n
    gy0, gy1 = 0.30 * n, 0.82 * n
    foam_y0, foam_y1 = 0.20 * n, 0.36 * n
    hx0, hx1 = 0.66 * n, 0.78 * n          # asa
    hy0, hy1 = 0.40 * n, 0.66 * n
    bubbles = [(0.42, 0.55, 0.035), (0.54, 0.66, 0.03), (0.47, 0.72, 0.025)]
    for y in range(n):
        buf.append(0)  # filtro none por fila
        for x in range(n):
            color = BG
            # asa (anillo)
            if rounded(x, y, hx0, hy0, hx1, hy1, 0.06 * n) and not rounded(
                x, y, hx0 + 0.04 * n, hy0 + 0.05 * n, hx1 - 0.005 * n, hy1 - 0.05 * n, 0.03 * n
            ):
                color = GLASS_HI
            # cuerpo del vaso
            if rounded(x, y, gx0, gy0, gx1, gy1, 0.05 * n):
                color = GLASS
                if x < gx0 + 0.06 * n:
                    color = GLASS_HI
                for bx, by, br in bubbles:
                    if (x - bx * n) ** 2 + (y - by * n) ** 2 <= (br * n) ** 2:
                        color = BUBBLE
            # espuma encima
            if rounded(x, y, gx0 - 0.02 * n, foam_y0, gx1 + 0.02 * n, foam_y1, 0.08 * n):
                color = FOAM
            buf.extend(color)
    raw = bytes(buf)
    comp = zlib.compress(raw, 9)

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0))  # 8-bit RGB
    png += chunk(b"IDAT", comp)
    png += chunk(b"IEND", b"")
    return png


for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
    with open(name, "wb") as fh:
        fh.write(make_icon(size))
    print("wrote", name)
