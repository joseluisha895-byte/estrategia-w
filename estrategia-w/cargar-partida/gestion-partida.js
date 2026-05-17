/* ================================================================
   gestion-partida.js — Lógica de la pantalla "Gestión de Partida"
   Referenciado en: gestion-partida.html
   Carpeta: /cargar-partida/

   Responsabilidades:
     1. Fondo hexagonal animado
     2. Leer la partida seleccionada desde localStorage ('ew_partida_actual')
        → escrita por cargar-partida.js al hacer click en una partida
     3. Mostrar mods activos de esa partida (editables)
     4. Selector de tamaño del mundo (precargado del guardado)
     5. Continuar al juego
     6. Eliminar la partida

   CLAVE localStorage compartida:
     'ew_partida_actual' → { id, nombre, fecha, mods[], tamano }
     'ew_partidas'       → array completo (se actualiza al guardar cambios)
     'ew_sesion'         → escrita aquí para que juego.js la lea
================================================================ */


/* ================================================================
   SECCIÓN 1 — FONDO HEXAGONAL
================================================================ */
(function () {
  const canvas = document.getElementById('bg');
  const ctx    = canvas.getContext('2d');
  let W, H, pts = [];
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; build(); }
  function build() {
    pts = [];
    const cols = Math.ceil(W/60)+2, rows = Math.ceil(H/52)+2;
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++)
      pts.push({ x:c*60+(r%2===0?0:30), y:r*52, speed:.0004+Math.random()*.0006, phase:Math.random()*Math.PI*2 });
  }
  function hexPath(cx,cy,r) {
    ctx.beginPath();
    for (let i=0;i<6;i++) { const a=Math.PI/180*(60*i-30); i===0?ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a)):ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a)); }
    ctx.closePath();
  }
  let t=0;
  function draw() { t++; ctx.clearRect(0,0,W,H); for (const p of pts) { const alpha=.04+.06*(.5+.5*Math.sin(t*p.speed*60+p.phase)); ctx.strokeStyle=`rgba(201,168,76,${alpha})`; ctx.lineWidth=.6; hexPath(p.x,p.y,26); ctx.stroke(); } requestAnimationFrame(draw); }
  window.addEventListener('resize', resize); resize(); draw();
})();


/* ================================================================
   SECCIÓN 2 — CATÁLOGO DE MODS
   Mismo que seleccion-mods.js. En el futuro ambos leerán
   del mismo archivo compartido para no duplicar.
================================================================ */
const MODS_DISPONIBLES = [
  {
    id:           'base-game',
    nombre:       'Base Game',
    version:      '0.1.0',
    autor:        'Estrategia W',
    descripcion:  'El mod oficial que da vida al mundo. Incluye la ciudad inicial del jugador, el sistema de población, las mecánicas base del reino y la generación procedural de la isla.',
    etiquetas:    ['Oficial', 'Gameplay', 'Recursos', 'Estructuras'],
    requerido:    true,
    thumbnail:    '../mods/base-game/thumbnail.png',
    dependencias: []
  }
  /* Más mods se añadirán aquí en el futuro */
];


/* ================================================================
   SECCIÓN 3 — ESTADO GLOBAL
================================================================ */

/* Mods activos actualmente en esta pantalla (Set de ids) */
let modsActivos = new Set();

/* Id del mod seleccionado en el panel derecho */
let modSeleccionadoId = null;

/* Tamaño del mundo elegido */
let tamanoElegido = 'mediano';

/* Objeto completo de la partida actual */
let partidaActual = null;


/* ================================================================
   SECCIÓN 4 — INICIALIZACIÓN
================================================================ */

/* ----------------------------------------------------------------
   init()
   Lee la partida seleccionada desde localStorage ('ew_partida_actual')
   La escribe cargar-partida.js al hacer click en una partida de la lista.
   Precarga los mods y el tamaño que tenía guardados esta partida.
---------------------------------------------------------------- */
function init() {
  /* Leer partida activa
     Escrita por cargar-partida.js → seleccionar() + click "Gestionar" */
  const raw = localStorage.getItem('ew_partida_actual');
  if (!raw) { alert('No hay partida seleccionada.'); regresar(); return; }

  try { partidaActual = JSON.parse(raw); }
  catch { regresar(); return; }

  /* Rellenar cabecera con nombre y fecha */
  document.getElementById('partida-label').textContent = partidaActual.nombre;
  document.getElementById('partida-fecha').textContent = partidaActual.fecha || '';

  /* Precargar mods guardados en esta partida */
  const modsGuardados = partidaActual.mods || [];
  modsGuardados.forEach(id => modsActivos.add(id));

  /* Si no tiene mods guardados, activar los requeridos por defecto */
  if (modsActivos.size === 0) {
    MODS_DISPONIBLES.filter(m => m.requerido).forEach(m => modsActivos.add(m.id));
  }

  /* Precargar tamaño guardado en esta partida */
  tamanoElegido = partidaActual.tamano || 'mediano';
  elegirTamano(tamanoElegido); /* Resalta el botón correcto */

  renderizarLista();
  actualizarContador();
  actualizarBotonJugar();
}


/* ================================================================
   SECCIÓN 5 — RENDERIZADO DE LISTA
================================================================ */

/* ----------------------------------------------------------------
   renderizarLista()
   Construye las .mod-card en #lista-mods con el estado
   de modsActivos de esta partida.
   id="lista-mods" → gestion-partida.html
---------------------------------------------------------------- */
function renderizarLista() {
  const contenedor = document.getElementById('lista-mods');
  contenedor.innerHTML = '';

  MODS_DISPONIBLES.forEach(mod => {
    const card = document.createElement('div');
    card.className = 'mod-card' + (modSeleccionadoId === mod.id ? ' activa' : '');
    card.dataset.id = mod.id;

    const thumbHTML = `
      <div class="mod-card-thumb">
        <img src="${mod.thumbnail}" alt="${mod.nombre}"
             onerror="this.parentElement.textContent='⚙'"
             style="width:100%;height:100%;object-fit:cover" />
      </div>`;

    const tagsHTML = mod.etiquetas.slice(0,2)
      .map(t => `<span class="mod-card-tag">${t}</span>`).join('');

    const reqHTML  = mod.requerido ? `<span class="mod-card-req">REQ</span>` : '';
    const statusOn = modsActivos.has(mod.id);

    card.innerHTML = `
      ${thumbHTML}
      <div class="mod-card-info">
        <div class="mod-card-nombre">${mod.nombre}</div>
        <div class="mod-card-version">v${mod.version}</div>
        <div class="mod-card-tags">${tagsHTML}</div>
      </div>
      ${reqHTML}
      <div class="mod-card-status ${statusOn?'on':''}" id="status-${mod.id}"></div>`;

    card.addEventListener('click', () => seleccionarMod(mod.id));
    contenedor.appendChild(card);
  });
}


/* ================================================================
   SECCIÓN 6 — SELECCIÓN Y DETALLE
================================================================ */

function seleccionarMod(id) {
  modSeleccionadoId = id;
  document.querySelectorAll('.mod-card').forEach(c =>
    c.classList.toggle('activa', c.dataset.id === id));
  const mod = MODS_DISPONIBLES.find(m => m.id === id);
  if (mod) verDetalle(mod);
}

function verDetalle(mod) {
  document.getElementById('detalle-vacio').style.display     = 'none';
  document.getElementById('detalle-contenido').style.display = 'flex';

  const img = document.getElementById('det-thumbnail');
  img.src = mod.thumbnail;
  img.onerror = () => { img.style.display = 'none'; };
  img.onload  = () => { img.style.display = 'block'; };

  document.getElementById('det-badge-req').style.display =
    mod.requerido ? 'block' : 'none';
  document.getElementById('det-nombre').textContent    = mod.nombre;
  document.getElementById('det-version').textContent   = `v${mod.version}`;
  document.getElementById('det-autor').textContent     = `por ${mod.autor}`;
  document.getElementById('det-descripcion').textContent = mod.descripcion;

  document.getElementById('det-etiquetas').innerHTML = mod.etiquetas
    .map(t => `<span class="det-etiqueta">${t}</span>`).join('');

  const depsWrap = document.getElementById('det-deps-wrap');
  if (mod.dependencias.length > 0) {
    depsWrap.style.display = 'flex';
    document.getElementById('det-deps-lista').textContent = mod.dependencias.join(', ');
  } else {
    depsWrap.style.display = 'none';
  }

  actualizarBotonToggle(mod);
}

function actualizarBotonToggle(mod) {
  const btn    = document.getElementById('btn-toggle');
  const activo = modsActivos.has(mod.id);
  if (mod.requerido) {
    btn.textContent = 'Mod Requerido — Siempre Activo';
    btn.disabled    = true;
    btn.className   = 'btn-toggle';
    return;
  }
  btn.disabled    = false;
  btn.className   = activo ? 'btn-toggle desactivar' : 'btn-toggle';
  btn.textContent = activo ? 'Desactivar Mod' : 'Activar Mod';
}


/* ================================================================
   SECCIÓN 7 — TOGGLE DE MODS
================================================================ */

function toggleMod() {
  if (!modSeleccionadoId) return;
  const mod = MODS_DISPONIBLES.find(m => m.id === modSeleccionadoId);
  if (!mod || mod.requerido) return;

  if (modsActivos.has(mod.id)) {
    const dependientes = MODS_DISPONIBLES.filter(m =>
      modsActivos.has(m.id) && m.dependencias.includes(mod.id));
    if (dependientes.length > 0) {
      alert(`No puedes desactivar "${mod.nombre}" porque "${dependientes[0].nombre}" depende de él.`);
      return;
    }
    modsActivos.delete(mod.id);
  } else {
    const faltantes = mod.dependencias.filter(dep => !modsActivos.has(dep));
    if (faltantes.length > 0) {
      alert(`Primero activa: ${faltantes.join(', ')}`);
      return;
    }
    modsActivos.add(mod.id);
  }

  /* Actualizar indicador visual en la card */
  const statusEl = document.getElementById(`status-${mod.id}`);
  if (statusEl) statusEl.classList.toggle('on', modsActivos.has(mod.id));

  /* Guardar cambios inmediatamente en la partida */
  guardarCambiosEnPartida();

  actualizarBotonToggle(mod);
  actualizarContador();
  actualizarBotonJugar();
}


/* ================================================================
   SECCIÓN 8 — SELECTOR DE TAMAÑO
================================================================ */

/* ----------------------------------------------------------------
   elegirTamano(tamano)
   Igual que en seleccion-mods.js.
   También guarda el cambio inmediatamente en la partida.
---------------------------------------------------------------- */
function elegirTamano(tamano) {
  tamanoElegido = tamano;
  ['pequeno','mediano','grande'].forEach(t => {
    const btn = document.getElementById(`tam-${t}`);
    if (btn) btn.classList.toggle('tamano-activo', t === tamano);
  });
  guardarCambiosEnPartida(); /* Guardar automáticamente al cambiar tamaño */
}


/* ================================================================
   SECCIÓN 9 — PERSISTENCIA
================================================================ */

/* ----------------------------------------------------------------
   guardarCambiosEnPartida()
   Guarda los mods activos y el tamaño actual en 'ew_partidas'
   sin salir de la pantalla. Se llama al hacer toggle o cambiar tamaño.
---------------------------------------------------------------- */
function guardarCambiosEnPartida() {
  if (!partidaActual) return;
  const raw      = localStorage.getItem('ew_partidas');
  const partidas = raw ? JSON.parse(raw) : [];
  const idx      = partidas.findIndex(p => p.id === partidaActual.id);
  if (idx !== -1) {
    partidas[idx].mods   = Array.from(modsActivos);
    partidas[idx].tamano = tamanoElegido;
    localStorage.setItem('ew_partidas', JSON.stringify(partidas));
  }
}

/* ----------------------------------------------------------------
   actualizarContador() — Actualiza "X activos" en la cabecera de lista
---------------------------------------------------------------- */
function actualizarContador() {
  const el = document.getElementById('contador-mods');
  el.textContent = `${modsActivos.size} ${modsActivos.size===1?'activo':'activos'}`;
}

/* ----------------------------------------------------------------
   actualizarBotonJugar() — Habilita/deshabilita el botón Continuar
---------------------------------------------------------------- */
function actualizarBotonJugar() {
  const btn  = document.getElementById('btn-jugar');
  const hint = document.getElementById('pie-hint');
  const ok   = modsActivos.size > 0;
  btn.disabled    = !ok;
  hint.textContent = ok
    ? `${modsActivos.size} mod(s) activo(s) · Tamaño: ${tamanoElegido}`
    : 'Activa al menos un mod para continuar';
}


/* ================================================================
   SECCIÓN 10 — ACCIONES PRINCIPALES
================================================================ */

/* ----------------------------------------------------------------
   iniciarJuego()
   Guarda la sesión activa y navega al juego.
   Llamada por: <button id="btn-jugar" onclick="iniciarJuego()">
---------------------------------------------------------------- */
function iniciarJuego() {
  if (modsActivos.size === 0) return;

  guardarCambiosEnPartida();

  /* Escribir sesión activa para que juego.js la lea */
  localStorage.setItem('ew_sesion', JSON.stringify({
    partidaId: partidaActual.id,
    nombre:    partidaActual.nombre,
    mods:      Array.from(modsActivos),
    tamano:    tamanoElegido
  }));

  /* Navegar a la pantalla de juego */
  window.location.href = '../juego/juego.html'; /* ← juego/juego.html */
}

/* ----------------------------------------------------------------
   eliminarPartida()
   Elimina la partida actual de localStorage y regresa a la lista.
   Llamada por: <button onclick="eliminarPartida()">
---------------------------------------------------------------- */
function eliminarPartida() {
  if (!partidaActual) return;

  const confirmar = confirm(
    `¿Seguro que quieres eliminar la partida "${partidaActual.nombre}"?\nEsta acción no se puede deshacer.`
  );
  if (!confirmar) return;

  /* Eliminar del array de partidas */
  const raw      = localStorage.getItem('ew_partidas');
  const partidas = raw ? JSON.parse(raw) : [];
  const sinEsta  = partidas.filter(p => p.id !== partidaActual.id);
  localStorage.setItem('ew_partidas', JSON.stringify(sinEsta));

  /* Limpiar la partida activa */
  localStorage.removeItem('ew_partida_actual');

  /* Volver a la lista de partidas */
  regresar();
}

/* ----------------------------------------------------------------
   regresar()
   Vuelve a cargar-partida.html
   La ruta es relativa: mismo directorio /cargar-partida/
---------------------------------------------------------------- */
function regresar() {
  window.location.href = 'cargar-partida.html'; /* ← mismo directorio */
}


/* ================================================================
   ARRANQUE
================================================================ */
init();
