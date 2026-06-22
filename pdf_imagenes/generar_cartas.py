import sys
sys.stdout.reconfigure(encoding='utf-8')

import os, glob, shutil
from PIL import Image
import imagehash

jpegs = sorted(glob.glob(os.path.join('pdf_imagenes/imagenes', '*.jpeg')))

# Deduplicate
hashes = {}
for fpath in jpegs:
    img = Image.open(fpath)
    h = imagehash.average_hash(img)
    if h not in hashes:
        hashes[h] = fpath

unique = sorted(hashes.values())
print(f'Unique cards: {len(unique)}')

# Copy to client
dest_dir = os.path.join('client', 'public', 'cards')
os.makedirs(dest_dir, exist_ok=True)

# Map from OCR (manually corrected)
card_names = {
    'page1_img2.jpeg':  ('LA CALAVERA', 1),
    'page1_img3.jpeg':  ('EL NOPAL', 2),
    'page1_img4.jpeg':  ('LA CANOA', 3),
    'page1_img5.jpeg':  ('EL VALIENTE', 4),
    'page1_img6.jpeg':  ('LA ESCALERA', 5),
    'page1_img7.jpeg':  ('EL CAZO', 6),
    'page1_img8.jpeg':  ('EL LOBO', 7),
    'page1_img9.jpeg':  ('LA COBRA', 8),
    'page1_img11.jpeg': ('LA BANDERA', 9),
    'page1_img12.jpeg': ('EL CAMARON', 10),
    'page1_img14.jpeg': ('LA RANA', 11),
    'page1_img15.jpeg': ('LA SIRENA', 12),
    'page1_img16.jpeg': ('LA SANDIA', 13),
    'page1_img17.jpeg': ('EL SOL', 14),
    'page1_img18.jpeg': ('LA MANZANA', 15),
    'page1_img19.jpeg': ('EL TAMBOR', 16),
    'page1_img20.jpeg': ('EL ALCE', 17),
    'page1_img21.jpeg': ('LA PALMA', 18),
    'page1_img22.jpeg': ('EL BARRIL', 19),
    'page1_img23.jpeg': ('EL JARRON', 20),
    'page1_img24.jpeg': ('LA ESTRELLA', 21),
    'page1_img25.jpeg': ('EL ALACRAN', 22),
    'page1_img26.jpeg': ('EL DIABLO', 23),
    'page1_img27.jpeg': ('LOS DADOS', 24),
    'page1_img28.jpeg': ('LA ARDILLA', 25),
    'page1_img30.jpeg': ('EL ARABE', 26),
    'page1_img31.jpeg': ('EL ARBOL', 27),
    'page1_img32.jpeg': ('EL SOMBRERO', 28),
    'page2_img12.jpeg': ('LA MANO', 29),
    'page2_img14.jpeg': ('LA GARZA', 30),
    'page2_img16.jpeg': ('LA MACETA', 31),
    'page2_img19.jpeg': ('LA CAMPANA', 32),
    'page2_img2.jpeg':  ('EL PEZ', 33),
    'page2_img21.jpeg': ('LAS JARAS', 34),
    'page2_img22.jpeg': ('EL ARPA', 35),
    'page2_img23.jpeg': ('EL AZTECA', 36),
    'page2_img25.jpeg': ('EL MELON', 37),
    'page2_img26.jpeg': ('LA BOTA', 38),
    'page2_img27.jpeg': ('EL PAJARO', 39),
    'page2_img31.jpeg': ('EL ELEFANTE', 40),
    'page2_img33.jpeg': ('EL CORAZON', 41),
    'page3_img17.jpeg': ('EL GALLO', 42),
    'page3_img26.jpeg': ('LA PERA', 43),
    'page3_img3.jpeg':  ('LA MARIPOSA', 44),
    'page3_img31.jpeg': ('EL MUNDO', 45),
    'page3_img7.jpeg':  ('EL BORRACHO', 46),
    'page3_img9.jpeg':  ('EL PAYASO', 47),
    'page4_img11.jpeg': ('LA CORONA', 48),
    'page4_img13.jpeg': ('EL PINGUINO', 49),
    'page4_img15.jpeg': ('EL PINO', 50),
    'page4_img5.jpeg':  ('LA ROSA', 51),
    'page4_img8.jpeg':  ('EL PARAGUAS', 52),
    'page5_img25.jpeg': ('EL MONO', 53),
}

# Generate rimas
rimas = {
    'LA CALAVERA': 'La calavera del cráneo no tiene cetáceo',
    'EL NOPAL': 'El nopal del desierto siempre está despierto',
    'LA CANOA': 'La canoa del mar se echa a navegar',
    'EL VALIENTE': 'El valiente de la fiesta nunca pierde la apuesta',
    'LA ESCALERA': 'Súbeme a la escalera para ver a mi chiquita',
    'EL CAZO': 'El cazo de la cocina hierve la gallina',
    'EL LOBO': 'El lobo de la montaña corre con gran saña',
    'LA COBRA': 'La cobra venenosa es muy peligrosa',
    'LA BANDERA': 'La bandera de la patria es la más bonita',
    'EL CAMARON': 'El camarón del río nada con frío',
    'LA RANA': 'La rana del estanque salta sin un tanque',
    'LA SIRENA': 'La sirena del mar con su canto hace llorar',
    'LA SANDIA': 'La sandía de la feria endulza la miseria',
    'EL SOL': 'El sol radiante brilla en el instante',
    'LA MANZANA': 'La manzana del huerto tiene dulce puerto',
    'EL TAMBOR': 'El tambor del soldado suena en el costado',
    'EL ALCE': 'El alce del bosque crece sin un posque',
    'LA PALMA': 'La palma del jardín se mece sin fin',
    'EL BARRIL': 'El barril de la abundancia lleno de esperanza',
    'EL JARRON': 'El jarrón con la flor tiene gran color',
    'LA ESTRELLA': 'La estrella del cielo brilla con gran celo',
    'EL ALACRAN': 'El alacrán venenoso es muy peligroso',
    'EL DIABLO': 'El diablo está en la cama con dolor de cabeza',
    'LOS DADOS': 'Los dados del jugador ruedan sin temor',
    'LA ARDILLA': 'La ardilla del bosque salta sin un posque',
    'EL ARABE': 'El árabe del desierto siempre está despierto',
    'EL ARBOL': 'El árbol de la vida siempre verde y florecida',
    'EL SOMBRERO': 'El sombrero del charro suena en el barro',
    'LA MANO': 'La mano del destino escribe tu camino',
    'LA GARZA': 'La garza del estanque vuela por el aire',
    'LA MACETA': 'La maceta con la flor tiene gran color',
    'LA CAMPANA': 'La campana de la iglesia toca con tristeza',
    'EL PEZ': 'El pez del río nada con brío',
    'LAS JARAS': 'Las jaras del indio vuelan sin fastidio',
    'EL ARPA': 'El arpa de la cantina suena como la neblina',
    'EL AZTECA': 'El azteca de la tribu baila con el nopal',
    'EL MELON': 'El melón de la huerta el que no lo come despierta',
    'LA BOTA': 'La bota del charro suena en el barro',
    'EL PAJARO': 'El pájaro que canta alegra el alma',
    'EL ELEFANTE': 'El elefante del circo baila sin un circo',
    'EL CORAZON': 'El corazón enamorado siempre está apasionado',
    'EL GALLO': 'El gallo despertó a todo el corral',
    'LA PERA': 'La pera de la canasta nadie la gasta',
    'LA MARIPOSA': 'La mariposa del jardín vuela sin fin',
    'EL MUNDO': 'El mundo es un pañuelo lleno de consuelo',
    'EL BORRACHO': 'El borracho de la cantina bebe su mezcalina',
    'EL PAYASO': 'El payaso de la fiesta nunca pierde la apuesta',
    'LA CORONA': 'La corona del rey brilla con gran ley',
    'EL PINGUINO': 'El pingüino del polo nada con un polo',
    'EL PINO': 'El pino del bosque crece sin un posque',
    'LA ROSA': 'La rosa del jardín tiene un bello fin',
    'EL PARAGUAS': 'El paraguas del amor cubre a los que están en flor',
    'EL MONO': 'El mono del circo baila sin un circo',
}

colors = [
    '#C41E3A', '#8B0000', '#2196F3', '#2C1810', '#795548',
    '#E65100', '#37474F', '#388E3C', '#006847', '#7CB342',
    '#2E7D32', '#006064', '#4CAF50', '#FF6F00', '#E53935',
    '#BF360C', '#5D4037', '#558B2F', '#5D4037', '#A1887F',
    '#FFD54F', '#BF360C', '#8B0000', '#1565C0', '#FF7043',
    '#8D6E63', '#388E3C', '#37474F', '#FFCCBC', '#B2DFDB',
    '#6D4C41', '#FDD835', '#0288D1', '#5D4037', '#AD1457',
    '#4E342E', '#F9A825', '#6D4C41', '#FF9800', '#7B1FA2',
    '#E53935', '#C41E3A', '#8BC34A', '#F48FB1', '#1565C0',
    '#F9A825', '#FF7043', '#FF8F00', '#0277BD', '#1B5E20',
    '#E91E63', '#2196F3', '#757575',
]

emoji_map = {
    'LA CALAVERA': '💀', 'EL NOPAL': '🌵', 'LA CANOA': '⛵',
    'EL VALIENTE': '💪', 'LA ESCALERA': '🪜', 'EL CAZO': '🍲',
    'EL LOBO': '🐺', 'LA COBRA': '🐍', 'LA BANDERA': '🇲🇽',
    'EL CAMARON': '🦐', 'LA RANA': '🐸', 'LA SIRENA': '🧜‍♀️',
    'LA SANDIA': '🍉', 'EL SOL': '☀️', 'LA MANZANA': '🍎',
    'EL TAMBOR': '🥁', 'EL ALCE': '🦌', 'LA PALMA': '🌴',
    'EL BARRIL': '🛢️', 'EL JARRON': '🏺', 'LA ESTRELLA': '⭐',
    'EL ALACRAN': '🦂', 'EL DIABLO': '😈', 'LOS DADOS': '🎲',
    'LA ARDILLA': '🐿️', 'EL ARABE': '🧔', 'EL ARBOL': '🌳',
    'EL SOMBRERO': '🎩', 'LA MANO': '✋', 'LA GARZA': '🦢',
    'LA MACETA': '🪴', 'LA CAMPANA': '🔔', 'EL PEZ': '🐟',
    'LAS JARAS': '🏹', 'EL ARPA': '🎶', 'EL AZTECA': '🪶',
    'EL MELON': '🍈', 'LA BOTA': '👢', 'EL PAJARO': '🐦',
    'EL ELEFANTE': '🐘', 'EL CORAZON': '❤️', 'EL GALLO': '🐓',
    'LA PERA': '🍐', 'LA MARIPOSA': '🦋', 'EL MUNDO': '🌎',
    'EL BORRACHO': '🍺', 'EL PAYASO': '🤡', 'LA CORONA': '👑',
    'EL PINGUINO': '🐧', 'EL PINO': '🌲', 'LA ROSA': '🌹',
    'EL PARAGUAS': '☂️', 'EL MONO': '🐵',
}

# Copy and rename images
print()
print('Copying card images...')
for fname, (nombre, idx) in sorted(card_names.items(), key=lambda x: x[1][1]):
    src = os.path.join('pdf_imagenes/imagenes', fname)
    dst = os.path.join(dest_dir, f'carta_{idx}.jpg')
    shutil.copy2(src, dst)
    print(f'  carta_{idx}.jpg -> {nombre}')

# Generate JS file
print()
print('Generating cartas.js...')
js_lines = ['export const CARTAS = [']
for fname, (nombre, idx) in sorted(card_names.items(), key=lambda x: x[1][1]):
    rima = rimas.get(nombre, f'{nombre} de la lotería')
    color = colors[idx - 1] if idx - 1 < len(colors) else '#666666'
    emoji = emoji_map.get(nombre, '🎴')
    js_lines.append(f'  {{ id: {idx}, nombre: "{nombre}", emoji: "{emoji}", color: "{color}", rima: "{rima}", imagen: "carta_{idx}.jpg" }},')
js_lines.append(']')
js_lines.append('')
js_lines.append('export function getCarta(id) {')
js_lines.append('  return CARTAS.find(c => c.id === id)')
js_lines.append('}')

js_content = '\n'.join(js_lines)
with open(os.path.join('client', 'src', 'data', 'cartas.js'), 'w', encoding='utf-8') as f:
    f.write(js_content)

print('Done! Generated cartas.js with 53 cards')
