import urllib.request, json, time, sys

API = 'https://loteria-mauve.vercel.app/api'
PASS = 0
FAIL = 0

def post(path, data, esperar=200):
    global PASS, FAIL
    req = urllib.request.Request(API + path, data=json.dumps(data).encode(), headers={'Content-Type':'application/json'}, method='POST')
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        body = json.loads(resp.read().decode())
        print(f'  [{resp.status}]', end=' ')
        return body
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try: body = json.loads(body)
        except: pass
        print(f'  [{e.code} ERROR]', end=' ')
        return body

def get(path):
    ts = int(time.time() * 1000)
    sep = '&' if '?' in path else '?'
    req = urllib.request.Request(API + path + sep + '_t=' + str(ts))
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read().decode())
        except: return {}

def check(cond, msg):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f'  OK: {msg}')
    else:
        FAIL += 1
        print(f'  FAIL: {msg}')

print('=' * 60)
print('PRUEBA E2E: Lotería Mexicana')
print('=' * 60)

# 1. Crear sala
print('\n1. CREAR SALA')
r1 = post('/crear-sala', {'nombre': 'Juan'})
salaId = r1.get('salaId')
jugId1 = r1.get('jugador', {}).get('id')
check(salaId and len(salaId) == 4, f'Sala creada: {salaId}')
check(jugId1 is not None, f'Jugador 1 ID: {jugId1[:8]}...')
check(len(r1.get('jugadores', [])) == 1, '1 jugador en la sala')

# 2. Crear una segunda sala (piso de referencia)
print('\n1b. CREAR OTRA SALA (aislamiento)')
r1b = post('/crear-sala', {'nombre': 'Pedro'})
salaId2 = r1b.get('salaId')
check(salaId != salaId2, f'Sala 2 distinta: {salaId2}')

# 3. Unirse
print('\n2. UNIRSE')
r2 = post('/unirse-sala', {'salaId': salaId, 'nombre': 'Maria'})
check(r2.get('error') is None, 'Maria se unió')
check(len(r2.get('jugadores', [])) == 2, '2 jugadores en sala')

# 4. Unirse con nombre repetido (debe fallar)
print('\n2b. UNIRSE NOMBRE REPETIDO')
r2b = post('/unirse-sala', {'salaId': salaId, 'nombre': 'Juan'})
check(r2b.get('error') == 'Ese nombre ya está en uso', 'Nombre repetido rechazado')

# 5. Unirse a sala inexistente
print('\n2c. UNIRSE SALA INEXISTENTE')
r2c = post('/unirse-sala', {'salaId': 'XXXX', 'nombre': 'Test'})
check(r2c.get('error') == 'La sala no existe', 'Sala inexistente rechazada')

# 6. Iniciar juego con menos de 2 jugadores (debe fallar)
print('\n2d. INICIAR CON <2 JUGADORES')
r_solo = post('/iniciar-juego', {'salaId': salaId2, 'jugadorId': r1b['jugador']['id']})
check(r_solo.get('error') == 'Mínimo 2 jugadores', 'Inicio con 1 jugador rechazado')

# 7. Iniciar juego
print('\n3. INICIAR JUEGO')
r3 = post('/iniciar-juego', {'salaId': salaId, 'jugadorId': jugId1})
tablero = r3.get('tablero', [])
check(len(tablero) == 16, f'Tablero tiene {len(tablero)} cartas')
cartas_unicas = len(set(tablero))
check(cartas_unicas == 16, f'Cartas únicas en tablero: {cartas_unicas}')
check(tablero == sorted(tablero), f'Cartas ordenadas asc')

# 8. Estado post-inicio
print('\n4. ESTADO POST-INICIO')
for intento in range(5):
    e = get(f'/estado-sala?salaId={salaId}&jugadorId={jugId1}')
    if e.get('estado') == 'jugando':
        break
    time.sleep(0.3)
check(e.get('estado') == 'jugando', f'Estado: {e.get("estado")}')
check(len(e.get('historial', [])) == 0, 'Historial vacío')
check(e.get('cartasRestantes', 0) == 53, f'53 cartas restantes')
check(len(e.get('jugadores', [])) == 2, '2 jugadores en estado')

# 9. Sacar cartas
print('\n5. SACAR CARTAS')
historial = []
for i in range(5):
    r = post('/siguiente-carta', {'salaId': salaId})
    cartaId = r.get('cartaId')
    if cartaId is not None:
        historial.append(cartaId)
        check(1 <= cartaId <= 53, f'Carta {i+1}: #{cartaId}')
    else:
        check(False, f'Carta {i+1}: error {r}')

check(len(set(historial)) == 5, '5 cartas distintas')

# 10. Verificar historial en estado
print('\n6. HISTORIAL EN ESTADO')
e2 = get(f'/estado-sala?salaId={salaId}&jugadorId={jugId1}')
check(len(e2.get('historial', [])) == 5, f'Historial: {len(e2["historial"])} cartas')
check(e2.get('cartasRestantes', 0) == 48, f'48 cartas restantes')

# 11. No host no puede iniciar
print('\n7. NO HOST NO PUEDE INICIAR')
jugId2 = r2.get('jugador', {}).get('id')
r_no_host = post('/iniciar-juego', {'salaId': salaId, 'jugadorId': jugId2})
check(r_no_host.get('error') == 'Solo el host puede iniciar', 'No host rechazado')

# 12. Lotería falsa (solo 5 cartas, no 16)
print('\n8. LOTERÍA FALSA')
r_falsa = post('/cantar-loteria', {'salaId': salaId, 'jugadorId': jugId1})
check(r_falsa.get('valida') == False, 'Lotería falsa detectada')
check('razon' in r_falsa, 'Razón de falsa')

# 13. Forzar lotería válida (modificar estado directamente)
# Necesitamos el tablero y asegurar que todas las cartas se han dibujado
print('\n9. SIMULAR LOTERÍA VÁLIDA')
# Creamos una sala nueva, nos unimos dos, empezamos
r_new = post('/crear-sala', {'nombre': 'Test'})
salaId3 = r_new.get('salaId')
jugId3 = r_new.get('jugador', {}).get('id')
post('/unirse-sala', {'salaId': salaId3, 'nombre': 'Jug2'})
r_start = post('/iniciar-juego', {'salaId': salaId3, 'jugadorId': jugId3})
tablero3 = r_start.get('tablero', [])

# Dibujar todas las cartas hasta que se acabe el mazo
for _ in range(60):
    r = post('/siguiente-carta', {'salaId': salaId3})
    if r.get('cartaId') is None and r.get('mazoVacio'):
        break

# Verificar la lotería (con todas las cartas dibujadas, debería ser válida)
e_prev = get(f'/estado-sala?salaId={salaId3}&jugadorId={jugId3}')
print(f'  Cartas historial: {len(e_prev.get("historial", []))}')
r_ganar = post('/cantar-loteria', {'salaId': salaId3, 'jugadorId': jugId3})
check(r_ganar.get('valida') == True, 'Lotería válida detectada')
check(r_ganar.get('ganador', {}).get('nombre') == 'Test', f'Ganador: {r_ganar.get("ganador", {}).get("nombre")}')

# 14. Estado post-lotería
print('\n10. ESTADO POST-LOTERÍA')
e3 = get(f'/estado-sala?salaId={salaId3}&jugadorId={jugId3}')
check(e3.get('estado') == 'terminado', f'Estado: {e3.get("estado")}')
ganador = e3.get('ganador') or {}
check(ganador.get('nombre') == 'Test', f'Ganador: {ganador.get("nombre")}')

# 15. Nuevo juego (reinicio)
print('\n11. NUEVO JUEGO')
r_nuevo = post('/nuevo-juego', {'salaId': salaId3})
check(r_nuevo.get('error') is None, 'Juego reiniciado')

e4 = get(f'/estado-sala?salaId={salaId3}&jugadorId={jugId3}')
check(e4.get('estado') == 'esperando', f'Estado post-reinicio: {e4.get("estado")}')
check(e4.get('historial', []) == [], 'Historial vacío post-reinicio')
check(len(e4.get('jugadores', [])) == 2, '2 jugadores post-reinicio')

# 16. Juego no activo
print('\n12. SIGUIENTE CARTA SIN JUEGO')
r_sin_juego = post('/siguiente-carta', {'salaId': salaId3})
check(r_sin_juego.get('error') == 'Juego no activo', 'Siguiente carta sin juego: rechazado')

# 17. Lotería sin juego
print('\n13. LOTERÍA SIN JUEGO')
r_lot_sin = post('/cantar-loteria', {'salaId': salaId3, 'jugadorId': jugId3})
check(r_lot_sin.get('error') == 'Juego no activo', 'Lotería sin juego: rechazado')

# 18. Verificar campo motivoFin en estado normal
print('\n14. CAMPO MOTIVOFIN')
e_motivo = get(f'/estado-sala?salaId={salaId}&jugadorId={jugId1}')
check('motivoFin' in e_motivo, 'Campo motivoFin existe en respuesta')
# El juego aun esta en curso (no terminado), debe ser null
if e_motivo.get('estado') == 'jugando':
    check(e_motivo.get('motivoFin') is None, 'motivoFin es null mientras juega')

# 19. Despues de loteria valida, motivoFin debe ser null (no abandono)
print('\n15. MOTIVOFIN TRAS LOTERÍA')
e_despues = get(f'/estado-sala?salaId={salaId3}&jugadorId={jugId3}')
if e_despues.get('estado') == 'terminado':
    check(e_despues.get('motivoFin') is None, 'motivoFin es null en victoria normal (no abandono)')

# 20. Verificar que solo llamar estado con un jugador no mata al otro (actividad reciente)
print('\n16. NO SE ELIMINA JUGADOR ACTIVO')
sala_abandono = post('/crear-sala', {'nombre': 'A1'})
sAId = sala_abandono.get('salaId')
jA1 = sala_abandono.get('jugador', {}).get('id')
post('/unirse-sala', {'salaId': sAId, 'nombre': 'A2'})
post('/iniciar-juego', {'salaId': sAId, 'jugadorId': jA1})
# Llamar estado solo para A1 (actualiza su actividad)
e_ab1 = get(f'/estado-sala?salaId={sAId}&jugadorId={jA1}')
check(len(e_ab1.get('jugadores', [])) == 2, 'Aun 2 jugadores (A2 no ha perdido actividad)')
check(e_ab1.get('estado') == 'jugando', 'Juego sigue activo')
check(e_ab1.get('motivoFin') is None, 'motivoFin es null (aun jugando)')

# RESUMEN
print('\n' + '=' * 60)
print('RESUMEN DE PRUEBAS')
print('=' * 60)
total = PASS + FAIL
print(f'  PASS: {PASS}/{total}')
print(f'  FAIL: {FAIL}/{total}')
print(f'  RATE: {PASS/total*100:.1f}%')
if FAIL == 0:
    print('\nALL TESTS PASSED')
else:
    print(f'\n{FAIL} test(s) failed')
print('=' * 60)
