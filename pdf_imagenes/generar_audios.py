import asyncio, os
import edge_tts

# Card names with proper Spanish accents for TTS
nombres_con_acentos = {
    1: "La Calavera",
    2: "El Nopal",
    3: "La Canoa",
    4: "El Valiente",
    5: "La Escalera",
    6: "El Cazo",
    7: "El Lobo",
    8: "La Cobra",
    9: "La Bandera",
    10: "El Camarón",
    11: "La Rana",
    12: "La Sirena",
    13: "La Sandía",
    14: "El Sol",
    15: "La Manzana",
    16: "El Tambor",
    17: "El Alce",
    18: "La Palma",
    19: "El Barril",
    20: "El Jarrón",
    21: "La Estrella",
    22: "El Alacrán",
    23: "El Diablo",
    24: "Los Dados",
    25: "La Ardilla",
    26: "El Árabe",
    27: "El Árbol",
    28: "El Sombrero",
    29: "La Mano",
    30: "La Garza",
    31: "La Maceta",
    32: "La Campana",
    33: "El Pez",
    34: "Las Jaras",
    35: "El Arpa",
    36: "El Azteca",
    37: "El Melón",
    38: "La Bota",
    39: "El Pájaro",
    40: "El Elefante",
    41: "El Corazón",
    42: "El Gallo",
    43: "La Pera",
    44: "La Mariposa",
    45: "El Mundo",
    46: "El Borracho",
    47: "El Payaso",
    48: "La Corona",
    49: "El Pingüino",
    50: "El Pino",
    51: "La Rosa",
    52: "El Paraguas",
    53: "El Mono",
}

audio_dir = os.path.join('client', 'public', 'audio')
os.makedirs(audio_dir, exist_ok=True)

VOICE = 'es-MX-JorgeNeural'

async def generar_audio(card_id, nombre):
    filename = f'carta_{card_id}.mp3'
    filepath = os.path.join(audio_dir, filename)
    tts = edge_tts.Communicate(nombre, voice=VOICE, rate='+10%')
    await tts.save(filepath)
    return filename

async def main():
    for card_id in sorted(nombres_con_acentos.keys()):
        nombre = nombres_con_acentos[card_id]
        fname = await generar_audio(card_id, nombre)
        print(f'  {fname} -> {nombre}')
    print(f'\nDone! Generated {len(nombres_con_acentos)} audio files in {audio_dir}')

asyncio.run(main())
