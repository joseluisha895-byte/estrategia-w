/* ================================================================
   cargar-partida.js — Lógica de la pantalla "Cargar Partida"
   Referenciado en: cargar-partida.html (<script src="cargar-partida.js">)

   Responsabilidades:
     1. Fondo hexagonal animado (canvas #bg)
     2. Leer partidas de localStorage y renderizar la lista
     3. Seleccionar una partida de la lista
     4. Jugar la partida seleccionada
     5. Eliminar la partida seleccionada
     6. Regresar al menú principal

   ALMACENAMIENTO:
     Clave localStorage: 'ew_partidas'  ← misma que nueva-partida.js
     Las partidas fueron guardadas por nueva-partida.js en ese formato:
       [{ id, nombre, fecha }, ...]
================================================================ */


/* ================================================================
   SECCIÓN 1 — FONDO HEXAGONAL ANIMADO
   Igual que en menu.js y nueva-partida.js
   Referencia al canvas: <canvas id="bg"> en cargar-partida.html
================================================================ */
(function () {
  const canvas = document.getElementById('bg'); /* ← cargar-partida.html */
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
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        pts.push({
          x:     c * 60 + (r % 2 === 0 ? 0 : 30),
          y:     r * 52,
          speed: .0004 + Math.random() * .0006,
          phase: Math.random() * Math.PI * 2
        });
      }
    }
  }
  function hexPath(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30);
      i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
              : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
  }
  let t = 0;
  function draw() {
    t++;
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      const alpha = .04 + .06 * (.5 + .5 * Math.sin(t * p.speed * 60 + p.phase));
      ctx.strokeStyle = `rgba(201,168,76,${alpha})`;
      ctx.lineWidth   = .6;
      hexPath(p.x, p.y, 26);
      ctx.stroke();
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize);
  resize();
  draw();
})();


/* ================================================================
   SECCIÓN 2 — ESTADO GLOBAL DE ESTA PANTALLA
   Variable que guarda cuál partida está seleccionada actualmente.
================================================================ */

/* ID de la partida actualmente seleccionada en la lista.
   null = ninguna seleccionada.
   Se actualiza cuando el usuario hace click en un item de la lista. */
let partidaSeleccionadaId = null;


/* ================================================================
   SECCIÓN 3 — UTILIDADES DE ALMACENAMIENTO
   Misma clave que nueva-partida.js: 'ew_partidas'
================================================================ */

/* Clave compartida con nueva-partida.js.
   Si la cambias aquí, cámbiala también allá. */
const STORAGE_KEY = 'ew_partidas';

/* ----------------------------------------------------------------
   leerPartidas()
   Retorna el array de partidas desde localStorage.
   Mismo comportamiento que en nueva-partida.js.
---------------------------------------------------------------- */
function leerPartidas() {
  const raw = localStorage.getItem(STORAGE_KEY); /* ← clave compartida con nueva-partida.js */
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/* ----------------------------------------------------------------
   escribirPartidas(lista)
   Sobreescribe el array de partidas en localStorage.
   Usada por eliminar() para quitar una partida de la lista.
---------------------------------------------------------------- */
function escribirPartidas(lista) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}


/* ================================================================
   SECCIÓN 4 — RENDERIZADO DE LA LISTA
================================================================ */

/* ----------------------------------------------------------------
   renderizarLista()
   Lee todas las partidas de localStorage y genera los <li>
   dentro de <ul id="lista-partidas"> en cargar-partida.html.

   Si no hay partidas, muestra el mensaje <p id="lista-vacia">.
   Cada <li> al hacer click llama a seleccionar(id).
---------------------------------------------------------------- */
function renderizarLista() {
  const lista     = document.getElementById('lista-partidas'); /* ← cargar-partida.html */
  const msgVacia  = document.getElementById('lista-vacia');    /* ← cargar-partida.html */
  const partidas  = leerPartidas();

  /* Limpiar lista actual antes de redibujar */
  lista.innerHTML = '';

  if (partidas.length === 0) {
    /* Mostrar mensaje de lista vacía y ocultar la lista */
    lista.style.display    = 'none';
    msgVacia.style.display = 'block';
    return;
  }

  /* Hay partidas: ocultar mensaje vacío y mostrar la lista */
  lista.style.display    = '';
  msgVacia.style.display = 'none';

  /* Crear un <li> por cada partida guardada */
  partidas.forEach(p => {
    const li = document.createElement('li');
    li.className   = 'partida-item';
    li.dataset.id  = p.id; /* Guardamos el id para recuperarlo en seleccionar() */

    /* Marcar como seleccionado si coincide con la selección actual */
    if (p.id === partidaSeleccionadaId) {
      li.classList.add('seleccionado');
    }

    li.innerHTML = `
      <span class="partida-nombre">${p.nombre}</span>
      <span class="partida-fecha">${p.fecha}</span>
    `;

    /* Al hacer click en el item, seleccionarlo */
    li.addEventListener('click', () => seleccionar(p.id)); /* ← llama a seleccionar() abajo */

    lista.appendChild(li);
  });
}


/* ================================================================
   SECCIÓN 5 — ACCIONES DE LOS BOTONES Y LA LISTA
================================================================ */

/* ----------------------------------------------------------------
   seleccionar(id)
   Llamada cuando el usuario hace click en un item de la lista.
   Actualiza la variable global partidaSeleccionadaId.
   Habilita los botones de Jugar y Eliminar.
   Resalta visualmente el item seleccionado.
   Parámetros:
     id → el id numérico de la partida (p.id del objeto en localStorage)
---------------------------------------------------------------- */
function seleccionar(id) {
  partidaSeleccionadaId = id;

  /* Actualizar clases visuales de todos los items */
  document.querySelectorAll('.partida-item').forEach(li => {
    li.classList.toggle('seleccionado', Number(li.dataset.id) === id);
  });

  /* Habilitar botones de acción ahora que hay una selección */
  document.getElementById('btn-jugar').disabled    = false; /* ← cargar-partida.html */
  document.getElementById('btn-eliminar').disabled = false; /* ← cargar-partida.html */

  limpiarMensaje();
}

/* ----------------------------------------------------------------
   jugar()
   Llamada por: <button id="btn-jugar" onclick="jugar()">
   Navega a la pantalla de juego con la partida seleccionada.

   FUTURO: Reemplazar el alert por navegación real:
     window.location.href = `../juego/juego.html?id=${partidaSeleccionadaId}`;
---------------------------------------------------------------- */
function jugar() {
  if (!partidaSeleccionadaId) {
    mostrarMensaje('⚠ Selecciona una partida primero', 'error');
    return;
  }

  const partidas = leerPartidas();
  const partida  = partidas.find(p => p.id === partidaSeleccionadaId);

  if (!partida) {
    mostrarMensaje('⚠ Partida no encontrada', 'error');
    return;
  }

  /* Guardar la partida activa para que gestion-partida.js la lea
     Clave: 'ew_partida_actual' → leída por gestion-partida.js → init() */
  localStorage.setItem('ew_partida_actual', JSON.stringify({
    id:     partida.id,
    nombre: partida.nombre,
    fecha:  partida.fecha  || '',
    mods:   partida.mods   || [],
    tamano: partida.tamano || 'mediano'
  }));

  /* Navegar a la pantalla de gestión de mods de esta partida */
  window.location.href = 'gestion-partida.html'; /* ← mismo directorio */
}

/* ----------------------------------------------------------------
   eliminar()
   Llamada por: <button id="btn-eliminar" onclick="eliminar()">
   Elimina la partida seleccionada de localStorage y refresca la lista.
---------------------------------------------------------------- */
function eliminar() {
  if (!partidaSeleccionadaId) {
    mostrarMensaje('⚠ Selecciona una partida primero', 'error');
    return;
  }

  const partidas  = leerPartidas();
  const partida   = partidas.find(p => p.id === partidaSeleccionadaId);
  const sinEsta   = partidas.filter(p => p.id !== partidaSeleccionadaId);

  escribirPartidas(sinEsta); /* ← actualiza localStorage sin la partida eliminada */

  /* Resetear la selección y deshabilitar botones */
  partidaSeleccionadaId = null;
  document.getElementById('btn-jugar').disabled    = true;
  document.getElementById('btn-eliminar').disabled = true;

  /* Redibujar la lista sin la partida eliminada */
  renderizarLista();

  mostrarMensaje(`✔ Partida "${partida?.nombre}" eliminada`, 'ok');
}

/* ----------------------------------------------------------------
   regresar()
   Llamada por: <button onclick="regresar()"> en cargar-partida.html
   Navega de vuelta al menú principal.
   La ruta '../index.html' sube un nivel desde /cargar-partida/
---------------------------------------------------------------- */
function regresar() {
  window.location.href = '../index.html'; /* ← conecta con index.html (menú principal) */
}


/* ================================================================
   SECCIÓN 6 — MENSAJES DE ESTADO
================================================================ */

/* ----------------------------------------------------------------
   mostrarMensaje(texto, tipo)
   Muestra un mensaje en <p id="accion-msg"> de cargar-partida.html.
   Parámetros:
     texto → string a mostrar
     tipo  → 'ok' (verde) | 'error' (rojo)
---------------------------------------------------------------- */
function mostrarMensaje(texto, tipo) {
  const el = document.getElementById('accion-msg'); /* ← cargar-partida.html */
  el.textContent = texto;
  el.className   = `accion-msg ${tipo}`;
}

/* ----------------------------------------------------------------
   limpiarMensaje()
   Oculta el mensaje de estado.
---------------------------------------------------------------- */
function limpiarMensaje() {
  const el = document.getElementById('accion-msg');
  el.textContent = '';
  el.className   = 'accion-msg';
}


/* ================================================================
   INICIALIZACIÓN
   Se ejecuta automáticamente al cargar la página.
   Renderiza la lista de partidas desde localStorage.
================================================================ */
renderizarLista(); /* ← Lee 'ew_partidas' de localStorage y dibuja la lista */
