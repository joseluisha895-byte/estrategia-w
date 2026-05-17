/* ================================================================
   seleccion-mods.js — Lógica de la pantalla "Selección de Mods"
   Referenciado en: seleccion-mods.html

   Responsabilidades:
     1. Fondo hexagonal animado
     2. Leer el nombre de la partida actual desde localStorage
     3. Cargar la lista de mods disponibles (desde MODS_DISPONIBLES)
     4. Renderizar las cards de mods
     5. Mostrar detalle de un mod al seleccionarlo
     6. Activar / desactivar mods
     7. Guardar mods activos en localStorage y navegar al juego

   ALMACENAMIENTO localStorage:
     'ew_partida_actual'  → { id, nombre } — escrita por nueva-partida.js
     'ew_partidas'        → array completo de partidas (lee y actualiza)
     Al confirmar, escribe los mods activos en la partida correspondiente.
================================================================ */


/* ================================================================
   SECCIÓN 1 — FONDO HEXAGONAL
   Igual que en el resto del juego.
================================================================ */
(function () {
  const canvas = document.getElementById('bg');
  const ctx    = canvas.getContext('2d');
  let W, H, pts = [];
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    build();
  }
  function build() {
    pts = [];
    const cols = Math.ceil(W / 60) + 2;
    const rows = Math.ceil(H / 52) + 2;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        pts.push({ x: c*60+(r%2===0?0:30), y: r*52,
                   speed: .0004+Math.random()*.0006,
                   phase: Math.random()*Math.PI*2 });
  }
  function hexPath(cx,cy,r) {
    ctx.beginPath();
    for (let i=0;i<6;i++) {
      const a = Math.PI/180*(60*i-30);
      i===0?ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a))
           :ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
    }
    ctx.closePath();
  }
  let t = 0;
  function draw() {
    t++;
    ctx.clearRect(0,0,W,H);
    for (const p of pts) {
      const alpha = .04+.06*(.5+.5*Math.sin(t*p.speed*60+p.phase));
      ctx.strokeStyle=`rgba(201,168,76,${alpha})`;
      ctx.lineWidth=.6;
      hexPath(p.x,p.y,26);
      ctx.stroke();
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize);
  resize(); draw();
})();


/* ================================================================
   SECCIÓN 2 — CATÁLOGO DE MODS DISPONIBLES
   En el futuro esto se cargará leyendo los mod.json de cada
   carpeta en /mods/. Por ahora es un array hardcodeado.

   Cada mod tiene:
     id         → identificador único (debe coincidir con su carpeta en /mods/)
     nombre     → nombre visible
     version    → string de versión
     autor      → autor del mod
     descripcion→ texto largo visible en el panel derecho
     etiquetas  → array de strings para los badges de categoría
     requerido  → boolean, si true no se puede desactivar
     thumbnail  → ruta relativa a la imagen (desde /nueva-partida/)
     dependencias → array de ids de mods requeridos antes que este
================================================================ */
const MODS_DISPONIBLES = [
  {
    id:          'base-game',
    nombre:      'Base Game',
    version:     '0.1.0',
    autor:       'Estrategia W',
    descripcion: 'El mod oficial que da vida al mundo. Incluye la ciudad inicial del jugador, el sistema de población, las mecánicas base del reino y la generación procedural de la isla. Este mod es la base sobre la que todos los demás construyen.',
    etiquetas:   ['Oficial', 'Gameplay', 'Recursos', 'Estructuras'],
    requerido:   true,
    /* Ruta relativa desde /nueva-partida/ hacia /mods/base-game/
       Si no existe la imagen, se usa el emoji de respaldo en la card */
    thumbnail:   '../mods/base-game/thumbnail.png',
    dependencias: []
  }

  /* ── AQUÍ SE AÑADIRÁN MÁS MODS EN EL FUTURO ────────────────────
  {
    id:          'fantasia',
    nombre:      'Mundo de Fantasía',
    version:     '0.1.0',
    autor:       'Estrategia W',
    descripcion: 'Transforma el mundo base en un reino de fantasía...',
    etiquetas:   ['Visual', 'Tropas', 'Recursos'],
    requerido:   false,
    thumbnail:   '../mods/fantasia/thumbnail.png',
    dependencias: ['base-game']
  },
  ─────────────────────────────────────────────────────────────── */
];


/* ================================================================
   SECCIÓN 3 — ESTADO GLOBAL DE ESTA PANTALLA
================================================================ */

/* Mods que el usuario tiene actualmente activados.
   Los requeridos se precargan al iniciar.
   Se guarda en localStorage al presionar "Comenzar Partida". */
let modsActivos = new Set();

/* ID del mod cuyo detalle se muestra actualmente en la columna derecha.
   null = ninguno seleccionado. */
let modSeleccionadoId = null;

/* Tamaño del mundo elegido por el jugador.
   Valores posibles: 'pequeno' | 'mediano' | 'grande'
   Por defecto: 'mediano' (coincide con el botón marcado en el HTML)
   Escrito en localStorage al iniciarJuego() */
let tamanoElegido = 'mediano';

/* Datos de la partida actual (nombre, id) leídos de localStorage */
let partidaActual = null;


/* ================================================================
   SECCIÓN 4 — INICIALIZACIÓN
   Se ejecuta al cargar la página.
================================================================ */

/* ----------------------------------------------------------------
   init()
   Punto de entrada principal.
   1. Lee la partida actual de localStorage
   2. Precarga mods requeridos
   3. Renderiza la lista de mods
   4. Muestra el nombre de la partida en el HUD
---------------------------------------------------------------- */
function init() {
  /* Leer la partida actual que guardó nueva-partida.js
     Clave: 'ew_partida_actual' → { id, nombre } */
  const raw = localStorage.getItem('ew_partida_actual');
  if (!raw) {
    /* Si no hay partida activa, regresar al paso anterior */
    alert('No hay una partida activa. Vuelve a crear una.');
    regresar();
    return;
  }

  try {
    partidaActual = JSON.parse(raw);
  } catch {
    regresar();
    return;
  }

  /* Mostrar nombre de partida en la cabecera
     id="partida-label" → seleccion-mods.html */
  document.getElementById('partida-label').textContent = partidaActual.nombre;

  /* Precargar mods requeridos (no se pueden desactivar) */
  MODS_DISPONIBLES
    .filter(m => m.requerido)
    .forEach(m => modsActivos.add(m.id));

  /* Renderizar la lista de cards */
  renderizarLista();
  actualizarContador();
  actualizarBotonJugar();
}


/* ================================================================
   SECCIÓN 5 — RENDERIZADO
================================================================ */

/* ----------------------------------------------------------------
   renderizarLista()
   Vacía y reconstruye todas las .mod-card en #lista-mods.
   Referencia al contenedor: <div id="lista-mods"> en seleccion-mods.html
---------------------------------------------------------------- */
function renderizarLista() {
  const contenedor = document.getElementById('lista-mods'); /* ← seleccion-mods.html */
  contenedor.innerHTML = '';

  MODS_DISPONIBLES.forEach(mod => {
    const card = document.createElement('div');
    card.className = 'mod-card' + (modSeleccionadoId === mod.id ? ' activa' : '');
    card.dataset.id = mod.id;

    /* Thumbnail: intenta cargar la imagen, si falla muestra emoji */
    const thumbHTML = `
      <div class="mod-card-thumb" id="thumb-card-${mod.id}">
        <img src="${mod.thumbnail}"
             alt="${mod.nombre}"
             onerror="this.parentElement.textContent='⚙'"
             style="width:100%;height:100%;object-fit:cover" />
      </div>`;

    /* Tags: solo los 2 primeros para no saturar la card */
    const tagsHTML = mod.etiquetas.slice(0, 2)
      .map(t => `<span class="mod-card-tag">${t}</span>`)
      .join('');

    /* Badge "REQ" si es requerido */
    const reqHTML = mod.requerido
      ? `<span class="mod-card-req">REQ</span>`
      : '';

    /* Indicador de estado ON/OFF */
    const statusOn = modsActivos.has(mod.id);

    card.innerHTML = `
      ${thumbHTML}
      <div class="mod-card-info">
        <div class="mod-card-nombre">${mod.nombre}</div>
        <div class="mod-card-version">v${mod.version}</div>
        <div class="mod-card-tags">${tagsHTML}</div>
      </div>
      ${reqHTML}
      <div class="mod-card-status ${statusOn ? 'on' : ''}" id="status-${mod.id}"></div>
    `;

    /* Al hacer click en la card → mostrar detalle */
    card.addEventListener('click', () => seleccionarMod(mod.id));

    contenedor.appendChild(card);
  });
}


/* ================================================================
   SECCIÓN 6 — SELECCIÓN Y DETALLE
================================================================ */

/* ----------------------------------------------------------------
   seleccionarMod(id)
   Marca la card como activa visualmente y muestra el detalle
   en la columna derecha.
   Llamada al hacer click en una .mod-card.
   Parámetros:
     id → string, el id del mod en MODS_DISPONIBLES
---------------------------------------------------------------- */
function seleccionarMod(id) {
  modSeleccionadoId = id;

  /* Actualizar clase .activa en todas las cards */
  document.querySelectorAll('.mod-card').forEach(card => {
    card.classList.toggle('activa', card.dataset.id === id);
  });

  /* Buscar el mod en el catálogo y mostrar su detalle */
  const mod = MODS_DISPONIBLES.find(m => m.id === id);
  if (mod) verDetalle(mod);
}


/* ----------------------------------------------------------------
   verDetalle(mod)
   Rellena todos los campos del panel derecho con los datos del mod.
   Oculta el estado vacío y muestra el contenido.
   Parámetros:
     mod → objeto del catálogo MODS_DISPONIBLES
---------------------------------------------------------------- */
function verDetalle(mod) {
  /* Alternar visibilidad entre estado vacío y contenido */
  document.getElementById('detalle-vacio').style.display    = 'none';
  document.getElementById('detalle-contenido').style.display = 'flex';

  /* Thumbnail grande
     id="det-thumbnail" → seleccion-mods.html */
  const img = document.getElementById('det-thumbnail');
  img.src = mod.thumbnail;
  img.onerror = () => { img.style.display = 'none'; };
  img.onload  = () => { img.style.display = 'block'; };

  /* Badge "Requerido" */
  document.getElementById('det-badge-req').style.display =
    mod.requerido ? 'block' : 'none';

  /* Nombre, versión, autor */
  document.getElementById('det-nombre').textContent  = mod.nombre;
  document.getElementById('det-version').textContent = `v${mod.version}`;
  document.getElementById('det-autor').textContent   = `por ${mod.autor}`;

  /* Etiquetas */
  const etiquetasEl = document.getElementById('det-etiquetas');
  etiquetasEl.innerHTML = mod.etiquetas
    .map(t => `<span class="det-etiqueta">${t}</span>`)
    .join('');

  /* Descripción */
  document.getElementById('det-descripcion').textContent = mod.descripcion;

  /* Dependencias */
  const depsWrap = document.getElementById('det-deps-wrap');
  if (mod.dependencias.length > 0) {
    depsWrap.style.display = 'flex';
    document.getElementById('det-deps-lista').textContent =
      mod.dependencias.join(', ');
  } else {
    depsWrap.style.display = 'none';
  }

  /* Botón toggle: texto y estilo según estado actual */
  actualizarBotonToggle(mod);
}


/* ----------------------------------------------------------------
   actualizarBotonToggle(mod)
   Cambia el texto y clase del botón Activar/Desactivar
   según si el mod está activo y si es requerido.
   Referencia: <button id="btn-toggle"> en seleccion-mods.html
---------------------------------------------------------------- */
function actualizarBotonToggle(mod) {
  const btn    = document.getElementById('btn-toggle'); /* ← seleccion-mods.html */
  const activo = modsActivos.has(mod.id);

  if (mod.requerido) {
    btn.textContent = 'Mod Requerido — Siempre Activo';
    btn.disabled    = true;
    btn.className   = 'btn-toggle';
    return;
  }

  btn.disabled  = false;
  btn.className = activo ? 'btn-toggle desactivar' : 'btn-toggle';
  btn.textContent = activo ? 'Desactivar Mod' : 'Activar Mod';
}


/* ================================================================
   SECCIÓN 7 — TOGGLE DE MODS
================================================================ */

/* ----------------------------------------------------------------
   toggleMod()
   Activa o desactiva el mod actualmente seleccionado en el detalle.
   Llamada por: <button id="btn-toggle" onclick="toggleMod()">
   No permite desactivar mods requeridos.
   Actualiza: el Set modsActivos, el indicador de la card, el contador.
---------------------------------------------------------------- */
function toggleMod() {
  if (!modSeleccionadoId) return;
  const mod = MODS_DISPONIBLES.find(m => m.id === modSeleccionadoId);
  if (!mod || mod.requerido) return;

  /* Verificar dependencias al desactivar */
  if (modsActivos.has(mod.id)) {
    /* ¿Algún mod activo depende de este? */
    const dependientes = MODS_DISPONIBLES.filter(m =>
      modsActivos.has(m.id) && m.dependencias.includes(mod.id)
    );
    if (dependientes.length > 0) {
      alert(`No puedes desactivar "${mod.nombre}" porque "${dependientes[0].nombre}" depende de él.`);
      return;
    }
    modsActivos.delete(mod.id);
  } else {
    /* Verificar que las dependencias estén activas */
    const faltantes = mod.dependencias.filter(dep => !modsActivos.has(dep));
    if (faltantes.length > 0) {
      alert(`Primero activa los mods requeridos: ${faltantes.join(', ')}`);
      return;
    }
    modsActivos.add(mod.id);
  }

  /* Actualizar indicador ON/OFF en la card */
  const statusEl = document.getElementById(`status-${mod.id}`);
  if (statusEl) statusEl.classList.toggle('on', modsActivos.has(mod.id));

  /* Actualizar botón toggle en el detalle */
  actualizarBotonToggle(mod);

  /* Actualizar contador y botón de jugar */
  actualizarContador();
  actualizarBotonJugar();
}


/* ================================================================
   SECCIÓN 8 — CONTADORES Y BOTÓN JUGAR
================================================================ */

/* ----------------------------------------------------------------
   actualizarContador()
   Actualiza el texto "X activos" en la cabecera de la lista.
   Referencia: <span id="contador-mods"> en seleccion-mods.html
---------------------------------------------------------------- */
function actualizarContador() {
  const el = document.getElementById('contador-mods'); /* ← seleccion-mods.html */
  el.textContent = `${modsActivos.size} ${modsActivos.size === 1 ? 'activo' : 'activos'}`;
}

/* ----------------------------------------------------------------
   actualizarBotonJugar()
   Habilita/deshabilita el botón "Comenzar Partida" según si
   hay al menos un mod activo (siempre habrá al menos base-game).
   Referencia: <button id="btn-jugar"> en seleccion-mods.html
---------------------------------------------------------------- */
function actualizarBotonJugar() {
  const btn  = document.getElementById('btn-jugar');  /* ← seleccion-mods.html */
  const hint = document.getElementById('pie-hint');
  const hayMods = modsActivos.size > 0;

  btn.disabled = !hayMods;
  hint.textContent = hayMods
    ? `${modsActivos.size} mod(s) activo(s) — listo para comenzar`
    : 'Activa al menos un mod para continuar';
}


/* ================================================================
   SECCIÓN 8B — SELECTOR DE TAMAÑO DEL MUNDO
================================================================ */

/* ----------------------------------------------------------------
   elegirTamano(tamano)
   Llamada por los botones .tamano-btn en seleccion-mods.html.
   Actualiza la variable global tamanoElegido y resalta el botón activo.
   Parámetros:
     tamano → 'pequeno' | 'mediano' | 'grande'

   Tamaños en hexágonos (usados por el generador del mundo en core/):
     pequeno → radio 8  (~200 hexágonos)
     mediano → radio 13 (~500 hexágonos)
     grande  → radio 18 (~1000 hexágonos)
---------------------------------------------------------------- */
function elegirTamano(tamano) {
  tamanoElegido = tamano;

  /* Quitar clase activa de todos los botones de tamaño */
  ['pequeno','mediano','grande'].forEach(t => {
    const btn = document.getElementById(`tam-${t}`); /* ← seleccion-mods.html */
    if (btn) btn.classList.toggle('tamano-activo', t === tamano);
  });
}


/* ================================================================
   SECCIÓN 9 — NAVEGACIÓN
================================================================ */

/* ----------------------------------------------------------------
   iniciarJuego()
   Llamada por: <button id="btn-jugar" onclick="iniciarJuego()">
   1. Guarda los mods activos en la partida correspondiente en localStorage
   2. Navega a la pantalla de juego

   FUTURO: La ruta al juego será '../juego/juego.html'
---------------------------------------------------------------- */
function iniciarJuego() {
  if (modsActivos.size === 0) return;

  /* Actualizar la partida en 'ew_partidas' con los mods seleccionados */
  const raw      = localStorage.getItem('ew_partidas');
  const partidas = raw ? JSON.parse(raw) : [];
  const idx      = partidas.findIndex(p => p.id === partidaActual.id);

  if (idx !== -1) {
    partidas[idx].mods = Array.from(modsActivos); /* Guardar array de ids */
    localStorage.setItem('ew_partidas', JSON.stringify(partidas));
  }

  /* Guardar la sesión activa: mods + tamaño del mundo
     Leída por juego.js al iniciar el mundo generado por core/world-gen.js */
  localStorage.setItem('ew_sesion', JSON.stringify({
    partidaId:  partidaActual.id,
    nombre:     partidaActual.nombre,
    mods:       Array.from(modsActivos),
    tamano:     tamanoElegido   /* 'pequeno' | 'mediano' | 'grande' */
  }));

  /* Guardar también el tamaño en la partida permanente */
  if (idx !== -1) {
    partidas[idx].tamano = tamanoElegido;
    localStorage.setItem('ew_partidas', JSON.stringify(partidas));
  }

  /* ── NAVEGAR AL JUEGO ────────────────────────────────────────────
     Cuando se cree la carpeta /juego/, descomentar:
       window.location.href = '../juego/juego.html';
     Por ahora confirmamos y nos quedamos.
  ─────────────────────────────────────────────────────────────── */
  alert(`⚔️ Partida "${partidaActual.nombre}" lista.\nMods activos: ${Array.from(modsActivos).join(', ')}\n\n(La pantalla de juego se implementará próximamente)`);
}

/* ----------------------------------------------------------------
   regresar()
   Llamada por: <button onclick="regresar()"> en seleccion-mods.html
   Vuelve al paso 1 (nombre de partida).
---------------------------------------------------------------- */
function regresar() {
  window.location.href = 'nueva-partida.html'; /* ← nueva-partida.html (mismo directorio) */
}


/* ================================================================
   ARRANQUE
================================================================ */
init();
