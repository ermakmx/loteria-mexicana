"""
Prueba de carga para validar escalabilidad.
Simula múltiples partidas concurrentes y mide tiempos de respuesta.
"""
import asyncio
import time
import sys
from statistics import mean, median

API = 'https://loteria-mauve.vercel.app/api'

async def session(nombre_base, idx, results):
    """Simula una partida completa: crear sala, unir jugadores, jugar hasta ganar."""
    base = f'{nombre_base}{idx}'
    t0 = time.time()

    try:
        import httpx
        async with httpx.AsyncClient(timeout=60) as c:
            # 1. Crear sala (con retry)
            for intento in range(8):
                r = await c.post(f'{API}/crear-sala', json={'nombre': base})
                if r.status_code == 200: break
                await asyncio.sleep(0.5 * (intento + 1))
            if r.status_code != 200:
                results.append({'ok': False, 'error': f'crear: {r.status_code}', 'ms': 0})
                return
            data = r.json()
            sala_id = data['salaId']
            jugador1 = data['jugador']

            # 2. Unir 2do jugador (con retry)
            for intento in range(8):
                r = await c.post(f'{API}/unirse-sala', json={'salaId': sala_id, 'nombre': f'{base}_p2'})
                if r.status_code == 200: break
                await asyncio.sleep(0.5 * (intento + 1))
            if r.status_code != 200:
                try: body = r.json()
                except: body = {}
                results.append({'ok': False, 'error': f'unir: {r.status_code} {body.get("error","")}', 'ms': 0})
                return

            await asyncio.sleep(1.0)  # dar tiempo para propagación

            # 3. Iniciar juego (con retry)
            for intento in range(8):
                r = await c.post(f'{API}/iniciar-juego', json={'salaId': sala_id, 'jugadorId': jugador1['id']})
                if r.status_code == 200: break
                await asyncio.sleep(0.5 * (intento + 1))
            if r.status_code != 200:
                results.append({'ok': False, 'error': f'iniciar: {r.status_code}', 'ms': 0})
                return

            # 4. Sacar cartas hasta que alguien gane
            for turno in range(60):
                for intento in range(8):
                    r = await c.post(f'{API}/siguiente-carta', json={'salaId': sala_id})
                    if r.status_code == 200: break
                    await asyncio.sleep(0.3 * (intento + 1))
                if r.status_code != 200:
                    results.append({'ok': False, 'error': f'carta {turno}: {r.status_code}', 'ms': 0})
                    return
                carta_data = r.json()

                # Verificar si el jugador1 ya tiene todas las cartas
                for intento in range(3):
                    r = await c.get(f'{API}/estado-sala?salaId={sala_id}&jugadorId={jugador1["id"]}')
                    if r.status_code == 200: break
                    await asyncio.sleep(0.3)
                if r.status_code != 200:
                    continue
                estado = r.json()
                tablero = estado.get('tablero', [])
                historial = set(estado.get('historial', []))
                if tablero and all(c in historial for c in tablero):
                    for intento in range(3):
                        r = await c.post(f'{API}/cantar-loteria', json={'salaId': sala_id, 'jugadorId': jugador1['id']})
                        if r.status_code == 200: break
                        await asyncio.sleep(0.3)
                    loteria = r.json() if r.status_code == 200 else {}
                    if loteria.get('valida'):
                        break

            elapsed = (time.time() - t0) * 1000
            results.append({'ok': True, 'error': None, 'ms': round(elapsed)})

    except Exception as e:
        results.append({'ok': False, 'error': str(e), 'ms': 0})

async def main():
    n_concurrentes = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    print(f'=== PRUEBA DE CARGA: {n_concurrentes} partidas concurrentes ===')
    print()

    results = []
    t_start = time.time()

    tasks = [session('carga', i, results) for i in range(n_concurrentes)]
    await asyncio.gather(*tasks)

    total_ms = (time.time() - t_start) * 1000
    ok = [r for r in results if r['ok']]
    fail = [r for r in results if not r['ok']]
    tiempos = [r['ms'] for r in ok]

    print(f'Completado en {total_ms:.0f}ms')
    print(f'  OK:     {len(ok)}/{n_concurrentes}')
    print(f'  FAIL:   {len(fail)}/{n_concurrentes}')
    if tiempos:
        print(f'  Tiempo promedio: {mean(tiempos):.0f}ms')
        print(f'  Tiempo mediana:  {median(tiempos):.0f}ms')
        print(f'  Tiempo min:      {min(tiempos):.0f}ms')
        print(f'  Tiempo max:      {max(tiempos):.0f}ms')
    print()

    if fail:
        print('ERRORES:')
        for f in fail[:10]:
            print(f'  - {f["error"]}')

    return 0 if len(fail) == 0 else 1

if __name__ == '__main__':
    exit(asyncio.run(main()))
