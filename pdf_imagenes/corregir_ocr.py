import sys
sys.stdout.reconfigure(encoding='utf-8')

import os, glob, tempfile
from PIL import Image
import imagehash
import easyocr

jpegs = sorted(glob.glob(os.path.join('pdf_imagenes/imagenes', '*.jpeg')))
print(f'Total card images: {len(jpegs)}')

dhashes = {}
for fpath in jpegs:
    img = Image.open(fpath)
    dh = imagehash.dhash(img)
    ph = imagehash.phash(img)
    ah = imagehash.average_hash(img)
    key = (dh, ph, ah)
    if key not in dhashes:
        dhashes[key] = os.path.basename(fpath)

print(f'Unique (triple hash): {len(dhashes)}')

all_phash = []
for fpath in jpegs:
    img = Image.open(fpath)
    ph = imagehash.phash(img)
    all_phash.append((ph, os.path.basename(fpath)))

groups = []
used = set()
for i, (ph1, f1) in enumerate(all_phash):
    if i in used: continue
    group = [f1]
    used.add(i)
    for j, (ph2, f2) in enumerate(all_phash):
        if j in used: continue
        if ph1 - ph2 < 5:
            group.append(f2)
            used.add(j)
    groups.append(group)

print(f'Similarity groups (hamming < 5): {len(groups)}')
for g in groups:
    if len(g) > 1:
        print(f'  Duplicates: {g}')

problem_images = [
    'page1_img27.jpeg',
    'page1_img28.jpeg',
    'page2_img2.jpeg',
    'page2_img23.jpeg',
    'page2_img31.jpeg',
    'page3_img9.jpeg',
    'page4_img13.jpeg',
    'page1_img14.jpeg',
    'page1_img17.jpeg',
    'page1_img4.jpeg',
    'page3_img17.jpeg',
    'page3_img7.jpeg',
]

reader = easyocr.Reader(['es'], gpu=False)

print()
print('Re-running OCR on problem images...')
for fname in problem_images:
    fpath = os.path.join('pdf_imagenes/imagenes', fname)
    img = Image.open(fpath)
    img2 = img.resize((img.width*2, img.height*2), Image.LANCZOS)
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        img2.save(tmp.name)
        result = reader.readtext(tmp.name, detail=0, paragraph=True)
        os.unlink(tmp.name)
    texts = [t.strip() for t in result if t.strip()]
    print(f'{fname}: {" | ".join(texts)}')
