"""Junta en una sola imagen los fotogramas sueltos de out/ (para revisar). Uso: python3 hoja.py salida.jpg out/a.jpg out/b.jpg ..."""
import sys
from PIL import Image

salida, *fs = sys.argv[1:]
ims = [Image.open(f) for f in fs]
h = 700
ims = [im.resize((int(im.size[0] * h / im.size[1]), h)) for im in ims]
s = Image.new('RGB', (sum(i.size[0] for i in ims) + 8 * len(ims), h), 'white')
x = 0
for im in ims:
    s.paste(im, (x, 0))
    x += im.size[0] + 8
s.thumbnail((2600, 2600))
s.save(salida)
