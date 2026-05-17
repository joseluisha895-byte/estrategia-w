/* ================================================================
   nueva-partida.js — Lógica de la pantalla "Nueva Partida"
   Referenciado en: nueva-partida.html (<script src="nueva-partida.js">)

   Responsabilidades:
     1. Fondo hexagonal animado (canvas #bg)
     2. Guardar partida en localStorage
     3. Jugar partida (guardar + redirigir al juego)
     4. Eliminar partida del localStorage
     5. Regresar al menú principal

   ALMACENAMIENTO:
     Clave localStorage: 'ew_partidas'
     Formato: JSON array de objetos { id, nombre, fecha }
     Esta misma clave la lee cargar-partida.js para listar partidas.
================================================================ */


/* ================================================================
   SECCIÓN 1 — FONDO HEXAGONAL ANIMADO
   Reutiliza la misma lógica que menu.js.
   Referencia al canvas: <canvas id="bg"> en nueva-partida.html
================================================================ */
(function () {
  const canvas = document.getElementById('bg'); /* ← nueva-partida.html */
  const ctx    = canvas.getContext('2d');
  let W, H, pts = [];

  /* Ajusta el canvas al tamaño de la ventana y reconstruye hexágonos */
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    build();
  }

  /* Genera las posiciones y propiedades de cada hexágono */
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

  /* Traza el contorno de un hexágono en el canvas */
  function hexPath(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30);
      i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
              : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
  }

  /* Bucle de animación: limpia y redibuja cada frame */
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
   SECCIÓN 2 — UTILIDADES DE ALMACENAMIENTO
   Funciones internas para leer y escribir partidas en localStorage.
   La clave 'ew_partidas' es compartida con cargar-partida.js.
================================================================ */

/* Clave usada en localStorage para todas las partidas guardadas.
   Si la cambias aquí, cámbiala también en cargar-partida.js */
const STORAGE_KEY = 'ew_partidas';

/* ----------------------------------------------------------------
   leerPartidas()
   Retorna el array de partidas guardadas en localStorage.
   Si no existe la clave aún, retorna un array vacío.
   Formato de cada partida: { id, nombre, fecha }
---------------------------------------------------------------- */
function leerPartidas() {
  const raw = localStorage.getItem(STORAGE_KEY);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return []; /* Si el JSON está corrupto, empezar de cero */
  }
}

/* ----------------------------------------------------------------
   escribirPartidas(lista)
   Guarda el array completo de partidas en localStorage.
   Parámetros:
     lista → array de objetos { id, nombre, fecha }
---------------------------------------------------------------- */
function escribirPartidas(lista) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

/* ----------------------------------------------------------------
   mostrarMensaje(texto, tipo)
   Muestra un mensaje de estado bajo el campo de nombre.
   El elemento <p id="field-msg"> está en nueva-partida.html.
   Parámetros:
     texto → string a mostrar
     tipo  → 'ok' (verde) | 'error' (rojo)
---------------------------------------------------------------- */
function mostrarMensaje(texto, tipo) {
  const el = document.getElementById('field-msg'); /* ← nueva-partida.html */
  el.textContent = texto;
  el.className   = `field-msg ${tipo}`;
}

/* ----------------------------------------------------------------
   limpiarMensaje()
   Borra el mensaje de estado del campo de nombre.
---------------------------------------------------------------- */
function limpiarMensaje() {
  const el = document.getElementById('field-msg');
  el.textContent = '';
  el.className   = 'field-msg';
}

/* ----------------------------------------------------------------
   obtenerNombre()
   Lee y limpia el texto del input de nombre.
   El elemento <input id="nombre-partida"> está en nueva-partida.html.
   Retorna: string con el nombre ingresado (sin espacios extra)
---------------------------------------------------------------- */
function obtenerNombre() {
  const input = document.getElementById('nombre-partida'); /* ← nueva-partida.html */
  return input.value.trim();
}


/* ================================================================
   SECCIÓN 3 — ACCIONES DE LOS BOTONES
   Cada función es llamada por un onclick en nueva-partida.html.
================================================================ */

/* ----------------------------------------------------------------
   guardar()
   Llamada por: <button onclick="guardar()"> en nueva-partida.html
   Guarda la partida actual en localStorage sin salir de la pantalla.

   Lógica:
     1. Lee el nombre del input
     2. Valida que no esté vacío
     3. Verifica que no exista ya una partida con ese nombre
     4. Crea un objeto partida con id único y fecha
     5. Lo agrega al array y escribe en localStorage
     6. Muestra mensaje de éxito
---------------------------------------------------------------- */
function guardar() {
  const nombre = obtenerNombre();

  /* Validación: nombre requerido */
  if (!nombre) {
    mostrarMensaje('⚠ Ingresa un nombre para la partida', 'error');
    return;
  }

  const partidas = leerPartidas();

  /* Validación: nombre duplicado */
  const existe = partidas.some(p => p.nombre.toLowerCase() === nombre.toLowerCase());
  if (existe) {
    mostrarMensaje('⚠ Ya existe una partida con ese nombre', 'error');
    return;
  }

  /* Crear la nueva partida */
  const nueva = {
    id:     Date.now(),                            /* ID único basado en timestamp */
    nombre: nombre,
    fecha:  new Date().toLocaleDateString('es-SV') /* Fecha de creación */
  };

  partidas.push(nueva);
  escribirPartidas(partidas); /* ← escribe en localStorage, clave 'ew_partidas' */

  mostrarMensaje(`✔ "${nombre}" guardada correctamente`, 'ok');
}

/* ----------------------------------------------------------------
   jugar()
   Llamada por: <button onclick="jugar()"> en nueva-partida.html
   Guarda la partida (si no existe) y navega a la selección de mods.
   La selección de mods es el PASO 2 antes de entrar al juego.

   Escribe 'ew_partida_actual' en localStorage para que
   seleccion-mods.js sepa qué partida está siendo configurada.
---------------------------------------------------------------- */
function jugar() {
  const nombre = obtenerNombre();

  if (!nombre) {
    mostrarMensaje('⚠ Ingresa un nombre antes de continuar', 'error');
    return;
  }

  /* Guardar automáticamente si no existe aún */
  const partidas = leerPartidas();
  let partida    = partidas.find(p => p.nombre.toLowerCase() === nombre.toLowerCase());

  if (!partida) {
    partida = {
      id:     Date.now(),
      nombre: nombre,
      fecha:  new Date().toLocaleDateString('es-SV'),
      mods:   []
    };
    partidas.push(partida);
    escribirPartidas(partidas);
  }

  /* Guardar la partida activa para que seleccion-mods.js la lea
     Clave: 'ew_partida_actual' → leída por seleccion-mods.js → init() */
  localStorage.setItem('ew_partida_actual', JSON.stringify({
    id:     partida.id,
    nombre: partida.nombre
  }));

  /* Navegar al paso 2: selección de mods (mismo directorio) */
  window.location.href = 'seleccion-mods.html';
}

/* ----------------------------------------------------------------
   eliminar()
   Llamada por: <button onclick="eliminar()"> en nueva-partida.html
   Elimina del localStorage la partida cuyo nombre coincide
   con lo que hay en el input.
---------------------------------------------------------------- */
function eliminar() {
  const nombre = obtenerNombre();

  if (!nombre) {
    mostrarMensaje('⚠ Escribe el nombre de la partida a eliminar', 'error');
    return;
  }

  const partidas    = leerPartidas();
  const sinEsta     = partidas.filter(p => p.nombre.toLowerCase() !== nombre.toLowerCase());

  if (sinEsta.length === partidas.length) {
    mostrarMensaje(`⚠ No se encontró una partida llamada "${nombre}"`, 'error');
    return;
  }

  escribirPartidas(sinEsta); /* ← actualiza localStorage sin esa partida */

  /* Limpiar el campo después de eliminar */
  document.getElementById('nombre-partida').value = '';
  mostrarMensaje(`✔ Partida "${nombre}" eliminada`, 'ok');
}

/* ----------------------------------------------------------------
   regresar()
   Llamada por: <button onclick="regresar()"> en nueva-partida.html
   Navega de vuelta al menú principal.
   La ruta '../index.html' sube un nivel desde /nueva-partida/
---------------------------------------------------------------- */
function regresar() {
  window.location.href = '../index.html'; /* ← conecta con index.html (menú principal) */
}
