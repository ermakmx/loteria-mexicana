"""
Reproduce los 400 intermitentes en /api/siguiente-carta.
Simula DOS navegadores con WebSocket activo (como el usuario real).
"""
import asyncio, json, sys
import httpx
import websockets

API = 'https://loteria-fsky.onrender.com/api'
WS  = 'wss://loteria-fsky.onrender.com/ws'

async def test():
    muestras = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    ok = 0
    fail = 0
    fail_detail = []
    max_concurrentes = 5
    sem = asyncio.Semaphore(max_concurrentes)

    async def una_partida(idx):
        nonlocal ok, fail
        async with sem:
            async with httpx.AsyncClient(timeout=30) as c:
                # 1. Crear sala (jug1)
                r = await c.post(f'{API}/crear-sala', json={'nombre': f'jug1_{idx}'})
                if r.status_code != 200:
                    fail += 1
                    fail_detail.append(f'[{idx}] crear: {r.status_code}')
                    return
                sala = r.json()
                sid = sala['salaId']
                jid1 = sala['jugador']['id']

                # 2. Conectar WS como jug1 (como Game.jsx haría)
                try:
                    ws1 = await websockets.connect(WS, close_timeout=5)
                    # enviar get-state para registrarse (como useWebSocket hace)
                    await ws1.send(json.dumps({'event': 'get-state', 'data': {'salaId': sid, 'jugadorId': jid1}}))
                    # esperar respuesta
                    resp = await asyncio.wait_for(ws1.recv(), timeout=5)
                except Exception as e:
                    fail += 1
                    fail_detail.append(f'[{idx}] ws1: {e}')
                    if 'ws1' in dir(): await ws1.close()
                    return

                # 3. Unir jug2
                r = await c.post(f'{API}/unirse-sala', json={'salaId': sid, 'nombre': f'jug2_{idx}'})
                if r.status_code != 200:
                    fail += 1
                    fail_detail.append(f'[{idx}] unirse: {r.status_code}')
                    await ws1.close()
                    return
                jid2 = r.json()['jugador']['id']

                # 4. Conectar WS como jug2
                try:
                    ws2 = await websockets.connect(WS, close_timeout=5)
                    await ws2.send(json.dumps({'event': 'get-state', 'data': {'salaId': sid, 'jugadorId': jid2}}))
                    resp = await asyncio.wait_for(ws2.recv(), timeout=5)
                except Exception as e:
                    fail += 1
                    fail_detail.append(f'[{idx}] ws2: {e}')
                    await ws1.close()
                    if 'ws2' in dir(): await ws2.close()
                    return

                # 5. Iniciar juego
                r = await c.post(f'{API}/iniciar-juego', json={'salaId': sid, 'jugadorId': jid1})
                if r.status_code != 200:
                    fail += 1
                    fail_detail.append(f'[{idx}] iniciar: {r.status_code} {r.text[:80]}')
                    await ws1.close()
                    await ws2.close()
                    return

                # 6. Sacar carta (el endpoint que da 400)
                r = await c.post(f'{API}/siguiente-carta', json={'salaId': sid})
                if r.status_code == 200:
                    ok += 1
                else:
                    fail += 1
                    cuerpo = r.text[:100] if r.text else '(vacio)'
                    fail_detail.append(f'[{idx}] carta: {r.status_code} {cuerpo}')

                # Leer broadcast del WS (si llega)
                try:
                    await asyncio.wait_for(ws1.recv(), timeout=1)
                except:
                    pass
                try:
                    await asyncio.wait_for(ws2.recv(), timeout=1)
                except:
                    pass

                await ws1.close()
                await ws2.close()

    # Correr partidas en paralelo con límite de concurrencia
    tareas = [una_partida(i) for i in range(muestras)]
    await asyncio.gather(*tareas)

    print(f'\n=== RESULTADOS ({muestras} muestras) ===')
    print(f'OK: {ok}  FAIL: {fail}  RATE: {ok/muestras*100:.1f}%')
    if fail_detail:
        # mostrar detalles agrupados
        from collections import Counter
        causas = Counter()
        for d in fail_detail:
            causas[d] += 1
        print('\nDetalle de fallos:')
        for detalle, count in causas.most_common(10):
            print(f'  ({count}x) {detalle}')

if __name__ == '__main__':
    asyncio.run(test())
