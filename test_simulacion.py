import urllib.request, json, time, sys

API = 'https://loteria-mauve.vercel.app/api'
PASS = 0; FAIL = 0

def post(path, data):
    req = urllib.request.Request(API + path, data=json.dumps(data).encode(), headers={'Content-Type':'application/json'}, method='POST')
    try:
        r = urllib.request.urlopen(req, timeout=10)
        return json.loads(r.read().decode()), r.status
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read().decode()), e.code
        except: return {'error': str(e)}, e.code

def get(path):
    ts = int(time.time() * 1000)
    sep = '&' if '?' in path else '?'
    req = urllib.request.Request(API + path + sep + '_t=' + str(ts))
    try:
        r = urllib.request.urlopen(req, timeout=10)
        return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read().decode())
        except: return {}

def check(cond, msg):
    global PASS, FAIL
    if cond: PASS += 1; print(f'  OK: {msg}')
    else: FAIL += 1; print(f'  FAIL: {msg}')
    return cond

def linea():
    print('-' * 60)

print('=' * 60)
print('SIMULACION DE JUEGO COMPLETO - LOTERIA MEXICANA')
print('=' * 60)

# ============================================================
# FASE 1: SETUP - Crear sala y unir jugadores
# ============================================================
print('\n[FASE 1] SETUP DE LA SALA')
linea()

r, code = post('/crear-sala', {'nombre': 'Carlos'})
salaId = r.get('salaId')
jug_host = r.get('jugador', {}).get('id')
check(code == 200 and salaId, f'Sala creada: {salaId} por Carlos ({jug_host[:8]}...)')

r, code = post('/unirse-sala', {'salaId': salaId, 'nombre': 'Ana'})
jug_ana = r.get('jugador', {}).get('id')
check(code == 200 and jug_ana, f'Ana se unio ({jug_ana[:8]}...)')

r, code = post('/unirse-sala', {'salaId': salaId, 'nombre': 'Luis'})
jug_luis = r.get('jugador', {}).get('id')
check(code == 200 and jug_luis, f'Luis se unio ({jug_luis[:8]}...)')

print(f'\n  3 jugadores en sala: Carlos (host), Ana, Luis')

# ============================================================
# FASE 2: INICIAR JUEGO
# ============================================================
print('\n[FASE 2] INICIAR JUEGO')
linea()

r, code = post('/iniciar-juego', {'salaId': salaId, 'jugadorId': jug_host})
check(code == 200, f'Juego iniciado')

# Obtener los tableros de cada jugador via estado
e = get(f'/estado-sala?salaId={salaId}&jugadorId={jug_host}')
tablero_host = e.get('tablero', [])
e2 = get(f'/estado-sala?salaId={salaId}&jugadorId={jug_ana}')
tablero_ana = e2.get('tablero', [])
e3 = get(f'/estado-sala?salaId={salaId}&jugadorId={jug_luis}')
tablero_luis = e3.get('tablero', [])

check(len(tablero_host) == 16, f'Tablero Carlos: {len(tablero_host)} cartas')
check(len(tablero_ana) == 16, f'Tablero Ana: {len(tablero_ana)} cartas')
check(len(tablero_luis) == 16, f'Tablero Luis: {len(tablero_luis)} cartas')

# Analizar tableros
conj_host = set(tablero_host)
conj_ana = set(tablero_ana)
conj_luis = set(tablero_luis)
compartidas = conj_host & conj_ana & conj_luis
print(f'\n  Cartas unicas Carlos: {len(conj_host)}')
print(f'  Cartas unicas Ana: {len(conj_ana)}')
print(f'  Cartas unicas Luis: {len(conj_luis)}')
print(f'  Cartas compartidas por los 3: {len(compartidas)}')
check(len(conj_host | conj_ana | conj_luis) <= 53, 'Total cartas unicas entre todos <= 53')

# ============================================================
# FASE 3: JUEGO - Sacar cartas y marcar
# ============================================================
print('\n[FASE 3] JUEGO EN CURSO')
linea()

marcadas_host = set()
marcadas_ana = set()
marcadas_luis = set()
historial = []
rondas = 0
ganador = None
mazo_vacio = False

while not ganador and not mazo_vacio:
    rondas += 1
    r, code = post('/siguiente-carta', {'salaId': salaId})
    
    if 'mazoVacio' in r:
        mazo_vacio = True
        print(f'\n  Ronda {rondas}: Mazo vacio!')
        break
    
    cartaId = r.get('cartaId')
    if cartaId is None:
        mazo_vacio = True
        break
    
    historial.append(cartaId)
    
    # Cada jugador marca la carta si la tiene en su tablero
    if cartaId in conj_host:
        marcadas_host.add(cartaId)
    if cartaId in conj_ana:
        marcadas_ana.add(cartaId)
    if cartaId in conj_luis:
        marcadas_luis.add(cartaId)
    
    # Verificar si alguien completo su tablero
    if len(marcadas_host) == 16 and not ganador:
        ganador = 'Carlos'
        print(f'\n  Ronda {rondas}: Carta #{cartaId} - CARLOS COMPLETO!')
    elif len(marcadas_ana) == 16 and not ganador:
        ganador = 'Ana'
        print(f'\n  Ronda {rondas}: Carta #{cartaId} - ANA COMPLETO!')
    elif len(marcadas_luis) == 16 and not ganador:
        ganador = 'Luis'
        print(f'\n  Ronda {rondas}: Carta #{cartaId} - LUIS COMPLETO!')
    elif rondas <= 5 or rondas % 10 == 0:
        print(f'  Ronda {rondas}: #{cartaId} | Host:{len(marcadas_host)} Ana:{len(marcadas_ana)} Luis:{len(marcadas_luis)}')

check(ganador is not None or mazo_vacio, f'Juego termino - Ganador: {ganador or "Nadie (mazo vacio)"}')

# ============================================================
# FASE 4: VERIFICAR LOTERIA
# ============================================================
print(f'\n[FASE 4] VERIFICAR LOTERIA ({ganador})')
linea()

if ganador:
    jugador_ganador = {'Carlos': jug_host, 'Ana': jug_ana, 'Luis': jug_luis}[ganador]
    r, code = post('/cantar-loteria', {'salaId': salaId, 'jugadorId': jugador_ganador})
    valida = r.get('valida', False)
    check(valida == True, f'Loteria valida para {ganador}: {valida}')
    if valida:
        check(r.get('ganador', {}).get('nombre') == ganador, f'Ganador reportado: {r.get("ganador", {}).get("nombre")}')

# ============================================================
# FASE 5: VERIFICAR ESTADO FINAL
# ============================================================
print('\n[FASE 5] ESTADO FINAL')
linea()

e_final = get(f'/estado-sala?salaId={salaId}&jugadorId={jug_host}')
check(e_final.get('estado') == 'terminado', f'Estado: {e_final.get("estado")}')
check(len(e_final.get('historial', [])) == rondas, f'Historial: {len(e_final.get("historial", []))} cartas ({rondas} rondas)')

# Estadisticas del juego
print(f'\n  === ESTADISTICAS ===')
print(f'  Total rondas: {rondas}')
print(f'  Cartas restantes en mazo: {e_final.get("cartasRestantes", 0)}')
print(f'  Ganador: {ganador}')
print(f'  Marcadas Carlos: {len(marcadas_host)}/16')
print(f'  Marcadas Ana: {len(marcadas_ana)}/16')
print(f'  Marcadas Luis: {len(marcadas_luis)}/16')

# Tableros compartidos vs unicos
print(f'\n  Cartas solo en tablero Carlos: {len(conj_host - conj_ana - conj_luis)}')
print(f'  Cartas solo en tablero Ana: {len(conj_ana - conj_host - conj_luis)}')
print(f'  Cartas solo en tablero Luis: {len(conj_luis - conj_host - conj_ana)}')

# ============================================================
# FASE 6: REINICIO Y NUEVA PARTIDA
# ============================================================
print('\n[FASE 6] NUEVA PARTIDA (REINICIO)')
linea()

r, code = post('/nuevo-juego', {'salaId': salaId})
check(code == 200, 'Juego reiniciado')

e_reinicio = get(f'/estado-sala?salaId={salaId}&jugadorId={jug_host}')
check(e_reinicio.get('estado') == 'esperando', f'Estado: {e_reinicio.get("estado")}')
check(len(e_reinicio.get('jugadores', [])) == 3, f'Aun 3 jugadores en sala')
check(len(e_reinicio.get('historial', [])) == 0, 'Historial limpiado')
check(e_reinicio.get('tablero') is None, 'Tablero reiniciado (null)')

# ============================================================
# RESUMEN
# ============================================================
print('\n' + '=' * 60)
print('RESULTADO DE LA SIMULACION')
print('=' * 60)
total = PASS + FAIL
print(f'  PASS: {PASS}/{total}')
print(f'  FAIL: {FAIL}/{total}')
print(f'  RATE: {PASS/total*100:.1f}%')
if FAIL == 0:
    print('\n  >>> SIMULACION COMPLETA EXITOSA <<<')
else:
    print(f'\n  >>> {FAIL} prueba(s) fallaron <<<')
print('=' * 60)
