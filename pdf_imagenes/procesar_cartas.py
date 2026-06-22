import sys
sys.stdout.reconfigure(encoding='utf-8')

import os, glob
from PIL import Image
import imagehash
import easyocr

reader = easyocr.Reader(['es'], gpu=False)
card_dir = r'pdf_imagenes/imagenes'
jpegs = sorted(glob.glob(os.path.join(card_dir, '*.jpeg')))
print(f'Total JPEG images: {len(jpegs)}')

hashes = {}
unique_images = []

for fpath in jpegs:
    fname = os.path.basename(fpath)
    try:
        img = Image.open(fpath)
        h = imagehash.average_hash(img)
        if h not in hashes:
            hashes[h] = fname
            unique_images.append(fpath)
    except Exception as e:
        print(f'Error processing {fname}: {e}')

print(f'Unique card images found: {len(unique_images)}')
print()

results = []
for idx, fpath in enumerate(unique_images[:60]):
    fname = os.path.basename(fpath)
    text = reader.readtext(fpath, detail=0, paragraph=True)
    texts = [t.strip() for t in text if t.strip()]
    results.append((fname, texts))
    print(f'{idx+1}. {fname}: {" | ".join(texts)}')

print()
print('=== ALL RESULTS ===')
for fname, texts in results:
    print(f'{fname}: {" | ".join(texts)}')
