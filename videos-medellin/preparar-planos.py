"""Corta los planos reales de Sorela que usan los anuncios, en vertical, con su voz
y sus palabras con tiempos (para los subtítulos palabra a palabra).

Uso: python3 -I preparar-planos.py <carpeta-crudos> <carpeta-transcripciones>
Salida: public/media/planos/<id>.mp4 (vídeo vertical sin sonido), <id>.wav (voz
normalizada) y src/planos.json (duración y palabras de cada plano).
"""
import json
import os
import subprocess
import sys

CRUDOS, TRANS = sys.argv[1], sys.argv[2]
SALIDA = 'public/media/planos'
os.makedirs(SALIDA, exist_ok=True)

# id: (crudo, desde, hasta, x del recorte vertical en el fotograma 3840x2160)
PLANOS = {
    'soy-sorela': ('04-img3769', 2.15, 5.15, 1250),
    'treinta-anos': ('04-img3769', 5.5, 17.6, 1250),
    'el-cambio': ('10-proximos-pasos', 6.85, 12.95, 1250),
    'leer-cuerpo': ('01-bienvenida', 6.55, None, 1250),
    'lo-que-frena': ('05-como-avanzar', 32.75, 39.5, 1250),
}

meta = {}
for pid, (crudo, desde, hasta, x) in PLANOS.items():
    d = json.load(open(f'{TRANS}/{crudo}.json'))
    palabras = [w for w in d['words'] if w.get('type', 'word') == 'word']
    if hasta is None:
        hasta = palabras[-1]['end'] + 0.35
    dura = round(hasta - desde, 3)
    src = f'{CRUDOS}/{crudo}.mov'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(desde), '-t', str(dura), '-i', src, '-an',
                    '-vf', f'crop=1215:2160:{x}:0,scale=1080:1920,eq=saturation=0.95:contrast=1.03',
                    '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', f'{SALIDA}/{pid}.mp4'], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(desde), '-t', str(dura), '-i', src, '-vn',
                    '-af', 'highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.04,afade=t=out:st=%.2f:d=0.12' % max(0, dura - 0.12),
                    '-ar', '48000', f'{SALIDA}/{pid}.wav'], check=True)
    ws = [{'t': w['text'], 'a': round(w['start'] - desde, 3), 'b': round(w['end'] - desde, 3)}
          for w in palabras if w['start'] >= desde - 0.05 and w['end'] <= hasta + 0.05]
    meta[pid] = {'dura': dura, 'palabras': ws}
    print(pid, dura, ' '.join(w['t'] for w in ws))

json.dump(meta, open('src/planos.json', 'w'), ensure_ascii=False, indent=1)
