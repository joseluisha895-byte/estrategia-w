/* ================================================================
   juego.js — Orquestador principal del juego
   Carpeta: /juego/
   Cargado por: juego.html (último script, después de Three.js y core/)

   Responsabilidades:
     1. Leer la sesión activa de localStorage ('ew_sesion')
     2. Mostrar pantalla de carga mientras se genera el mundo
     3. Llamar a WorldGen.generar() con la config de la partida
     4. Llamar a Renderer.init() para mostrar la esfera 3D
     5. Inicializar el HUD con los recursos de los mods activos
     6. Escuchar clicks en hexágonos (evento 'hexClick' de renderer.js)
     7. Autosave cada 60 segundos
     8. Guardar manualmente / salir al menú

   DEPENDENCIAS (cargadas antes en juego.html):
     - THREE (Three.js CDN)
     - WorldGen (core/world-gen.js)
     - Renderer (core/renderer.js)
================================================================ */


/* ================================================================
   SECCIÓN 1 — ESTADO GLOBAL DEL JUEGO
================================================================ */

/* Sesión activa leída de localStorage.
   Escrita por seleccion-mods.js o gestion-partida.js al iniciar.
   Formato: { partidaId, nombre, mods[], tamano } */
let _sesion = null;

/* WorldData retornado por WorldGen.generar()
   Guardado para acceso de mods y sistema de guardado */
let _worldData = null;

/* Semilla del mundo actual (para guardar y reproducir) */
let _semilla = null;

/* Timer del autosave */
let _timerAutosave = null;
const AUTOSAVE_INTERVAL = 60000; /* 60 segundos */

/* Hexágono actualmente seleccionado */
let _hexSeleccionado = null;


/* ================================================================
   SECCIÓN 2 — INICIALIZACIÓN
================================================================ */

/* ----------------------------------------------------------------
   init()
   Punto de entrada. Se ejecuta al cargar la página.
   Lee la sesión, muestra la carga, genera el mundo, arranca todo.
---------------------------------------------------------------- */
async function init() {
  /* Leer sesión activa de localStorage
     Escrita por seleccion-mods.js → iniciarJuego()
     o por gestion-partida.js → iniciarJuego() */
  const rawSesion = localStorage.getItem('ew_sesion');
  if (!rawSesion) {
    alert('No hay sesión activa. Vuelve al menú.');
    window.location.href = '../index.html';
    return;
  }

  try { _sesion = JSON.parse(rawSesion); }
  catch { window.location.href = '../index.html'; return; }

  /* Mostrar pantalla de carga mientras se genera el mundo */
  mostrarCarga('Generando el mundo…');

  /* Pequeña pausa para que el navegador pinte la pantalla de carga */
  await esperar(100);

  /* Recuperar semilla guardada (para reproducir el mismo mundo)
     Si la partida ya tiene semilla, usarla. Si no, se genera nueva. */
  _semilla = obtenerSemillaGuardada();

  /* Generar datos del mundo con WorldGen */
  _worldData = WorldGen.generar({
    tamano:      _sesion.tamano  || 'mediano',
    semilla:     _semilla,
    radioEsfera: 5
  });

  /* Guardar la semilla en la partida si es nueva */
  if (!_semilla) guardarSemilla(_worldData.semilla);
  _semilla = _worldData.semilla;

  /* Ajustar el canvas al área bajo el HUD antes de iniciar Three.js */
  ajustarCanvas();

  /* Inicializar el renderer 3D con los datos del mundo */
  Renderer.init('mundo-canvas', _worldData); /* ← renderer.js */

  /* Poblar el HUD con nombre de partida y recursos */
  inicializarHUD();

  /* Escuchar clicks en hexágonos (evento disparado por renderer.js) */
  document.getElementById('mundo-canvas')
    .addEventListener('hexClick', e => onHexClick(e.detail));

  /* Escuchar resize para ajustar el canvas */
  window.addEventListener('resize', ajustarCanvas);

  /* Iniciar autosave */
  _timerAutosave = setInterval(guardarPartida, AUTOSAVE_INTERVAL);

  /* Ocultar pantalla de carga */
  await esperar(400);
  ocultarCarga();

  console.log(`[Juego] Partida "${_sesion.nombre}" iniciada. Semilla: ${_semilla}`);
}


/* ================================================================
   SECCIÓN 3 — CANVAS Y RESIZE
================================================================ */

/* ----------------------------------------------------------------
   ajustarCanvas()
   Ajusta el tamaño del canvas para que no quede tapado por el HUD.
   Llamado al iniciar y al redimensionar la ventana.
---------------------------------------------------------------- */
function ajustarCanvas() {
  const hud    = document.getElementById('hud');
  const canvas = document.getElementById('mundo-canvas');
  const hudH   = hud ? hud.offsetHeight : 52;

  canvas.style.top    = hudH + 'px';
  canvas.style.height = `calc(100vh - ${hudH}px)`;
}


/* ================================================================
   SECCIÓN 4 — HUD
================================================================ */

/* ----------------------------------------------------------------
   inicializarHUD()
   Rellena el HUD con el nombre de la partida, los recursos
   registrados por los mods activos, y la info del mundo.
   Referencia: juego.html → #hud-nombre, #hud-recursos, #hud-mundo
---------------------------------------------------------------- */
function inicializarHUD() {
  /* Nombre de la partida */
  document.getElementById('hud-nombre').textContent = _sesion.nombre;

  /* Info del mundo */
  const cfg = WorldGen.TAMANOS[_worldData.tamano];
  document.getElementById('hud-mundo').textContent =
    `${cfg.label} · ${_worldData.meta.totalHex} hex`;

  /* Recursos: por ahora añadimos Población del base-game si está activo.
     En el futuro los mods registran sus recursos en Registry
     y juego.js los lee de ahí automáticamente. */
  const contenedorRecursos = document.getElementById('hud-recursos');
  contenedorRecursos.innerHTML = '';

  if (_sesion.mods && _sesion.mods.includes('base-game')) {
    contenedorRecursos.innerHTML = `
      <div class="recurso-item">
        <span class="recurso-icono">👥</span>
        <div class="recurso-info">
          <span class="recurso-label">Población</span>
          <span class="recurso-valor" id="rec-poblacion">50</span>
        </div>
      </div>
    `;
    /* FUTURO: más recursos de base-game y otros mods aquí */
  }
}


/* ================================================================
   SECCIÓN 5 — CLICKS EN HEXÁGONOS
================================================================ */

/* ----------------------------------------------------------------
   onHexClick(hexData)
   Llamado cuando renderer.js dispara el evento 'hexClick'.
   hexData → { q, r, terreno, hex } (desde mesh.userData)
   Abre el panel de información del hexágono.
---------------------------------------------------------------- */
function onHexClick(hexData) {
  _hexSeleccionado = hexData;

  /* Resaltar hexágono seleccionado */
  Renderer.limpiarResaltados();
  Renderer.resaltarHex(hexData.q, hexData.r, 0xffdd66);

  /* Rellenar y mostrar el panel de info */
  abrirPanel(hexData);
}

/* ----------------------------------------------------------------
   abrirPanel(hexData)
   Muestra el panel de información con los datos del hexágono.
   Referencia: juego.html → #panel-info, #panel-terreno, #panel-coords
---------------------------------------------------------------- */
function abrirPanel(hexData) {
  /* Nombre del terreno capitalizado */
  const nombreTerreno = hexData.terreno.id.charAt(0).toUpperCase()
    + hexData.terreno.id.slice(1);

  document.getElementById('panel-terreno').textContent = nombreTerreno;
  document.getElementById('panel-coords').textContent  =
    `Coordenadas: (${hexData.q}, ${hexData.r})`;

  /* Contenido dinámico del hexágono.
     Los mods pueden añadir info aquí registrando handlers en Registry.
     Por ahora mostramos si es transitable o no. */
  const contenido = document.getElementById('panel-contenido');

  const esTransitable = hexData.terreno.esTransitable;
  const esAgua        = hexData.terreno.esAgua;

  contenido.innerHTML = `
    <p class="panel-vacio" style="color: ${esTransitable ? '#4caf72' : '#c94444'}">
      ${esAgua ? '🌊 Agua — no transitable' :
        esTransitable ? '✔ Tierra transitable' : '⛰ No transitable'}
    </p>
    <!-- FUTURO: mods añaden estructuras, unidades, recursos aquí -->
  `;

  /* Mostrar panel y overlay */
  document.getElementById('panel-info').style.display  = 'block';
  document.getElementById('overlay').style.display     = 'block';
}

/* ----------------------------------------------------------------
   cerrarPanel()
   Cierra el panel de info y quita resaltados.
   Llamado por el botón ✕ y el overlay.
---------------------------------------------------------------- */
function cerrarPanel() {
  document.getElementById('panel-info').style.display = 'none';
  document.getElementById('overlay').style.display    = 'none';
  Renderer.limpiarResaltados();
  _hexSeleccionado = null;
}


/* ================================================================
   SECCIÓN 6 — GUARDADO
================================================================ */

/* ----------------------------------------------------------------
   obtenerSemillaGuardada()
   Lee la semilla del mundo guardada en la partida (si existe).
   Retorna: número (semilla) o null (si es partida nueva)
---------------------------------------------------------------- */
function obtenerSemillaGuardada() {
  const raw      = localStorage.getItem('ew_partidas');
  const partidas = raw ? JSON.parse(raw) : [];
  const partida  = partidas.find(p => p.id === _sesion.partidaId);
  return partida?.semilla || null;
}

/* ----------------------------------------------------------------
   guardarSemilla(semilla)
   Guarda la semilla del mundo en la partida para reproducirlo.
   Llamado la primera vez que se genera el mundo.
---------------------------------------------------------------- */
function guardarSemilla(semilla) {
  const raw      = localStorage.getItem('ew_partidas');
  const partidas = raw ? JSON.parse(raw) : [];
  const idx      = partidas.findIndex(p => p.id === _sesion.partidaId);
  if (idx !== -1) {
    partidas[idx].semilla = semilla;
    localStorage.setItem('ew_partidas', JSON.stringify(partidas));
  }
}

/* ----------------------------------------------------------------
   guardarPartida()
   Guarda el estado actual en localStorage.
   Llamado manualmente (botón 💾) y por el autosave.
   Referencia: juego.html → <button onclick="guardarPartida()">
---------------------------------------------------------------- */
function guardarPartida() {
  if (!_sesion) return;

  const raw      = localStorage.getItem('ew_partidas');
  const partidas = raw ? JSON.parse(raw) : [];
  const idx      = partidas.findIndex(p => p.id === _sesion.partidaId);

  if (idx !== -1) {
    partidas[idx].ultimoGuardado = new Date().toLocaleString('es-SV');
    partidas[idx].semilla        = _semilla;
    /* FUTURO: partidas[idx].estadoMundo = serializarEstadoMundo() */
    localStorage.setItem('ew_partidas', JSON.stringify(partidas));
  }

  mostrarNotif();
  console.log(`[Juego] Partida guardada: ${new Date().toLocaleTimeString()}`);
}

/* ----------------------------------------------------------------
   mostrarNotif()
   Muestra la notificación de guardado brevemente.
   Referencia: juego.html → #notif-guardado
---------------------------------------------------------------- */
function mostrarNotif() {
  const notif = document.getElementById('notif-guardado');
  notif.style.display = 'block';
  setTimeout(() => { notif.style.display = 'none'; }, 2500);
}


/* ================================================================
   SECCIÓN 7 — NAVEGACIÓN
================================================================ */

/* ----------------------------------------------------------------
   salirAlMenu()
   Limpia el renderer y navega al menú principal.
   Referencia: juego.html → <button onclick="salirAlMenu()">
---------------------------------------------------------------- */
function salirAlMenu() {
  guardarPartida(); /* Guardar antes de salir */

  if (_timerAutosave) clearInterval(_timerAutosave);
  Renderer.destruir(); /* Liberar memoria de Three.js */

  window.location.href = '../index.html'; /* ← index.html (raíz) */
}


/* ================================================================
   SECCIÓN 8 — PANTALLA DE CARGA
================================================================ */

/* ----------------------------------------------------------------
   mostrarCarga(texto)
   Crea e inserta la pantalla de carga en el DOM.
   Llamado antes de WorldGen.generar() que puede tardar un momento.
---------------------------------------------------------------- */
function mostrarCarga(texto) {
  if (document.getElementById('pantalla-carga')) return;
  const div = document.createElement('div');
  div.id        = 'pantalla-carga';
  div.className = 'pantalla-carga';
  div.innerHTML = `
    <p class="carga-titulo">Estrategia W</p>
    <div class="carga-barra-wrap">
      <div class="carga-barra"></div>
    </div>
    <p class="carga-texto">${texto}</p>
  `;
  document.body.appendChild(div);
}

/* ----------------------------------------------------------------
   ocultarCarga()
   Elimina la pantalla de carga con fade.
---------------------------------------------------------------- */
function ocultarCarga() {
  const el = document.getElementById('pantalla-carga');
  if (!el) return;
  el.style.transition = 'opacity .5s ease';
  el.style.opacity    = '0';
  setTimeout(() => el.remove(), 500);
}


/* ================================================================
   SECCIÓN 9 — UTILIDADES
================================================================ */

/* ----------------------------------------------------------------
   esperar(ms)
   Promesa que resuelve después de ms milisegundos.
   Usada en init() para dar tiempo al navegador a pintar la UI.
---------------------------------------------------------------- */
function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


/* ================================================================
   ARRANQUE — Se ejecuta al cargar el script
================================================================ */
init();
