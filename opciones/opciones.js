/* ================================================================
   opciones.js — Lógica de la pantalla "Opciones"
   Referenciado en: opciones.html (<script src="opciones.js">)

   Estado actual: PANTALLA EN MANTENIMIENTO
   Por ahora solo contiene:
     1. Fondo hexagonal animado (canvas #bg)
     2. Función regresar() para volver al menú principal

   FUTURO — Aquí se agregarán las secciones de configuración:
     - Audio (volumen música, efectos)
     - Gráficos (calidad del fondo, animaciones)
     - Controles (atajos de teclado)
     - Idioma
================================================================ */


/* ================================================================
   SECCIÓN 1 — FONDO HEXAGONAL ANIMADO
   Igual que en menu.js, nueva-partida.js y cargar-partida.js
   Referencia al canvas: <canvas id="bg"> en opciones.html
================================================================ */
(function () {
  const canvas = document.getElementById('bg'); /* ← opciones.html */
  const ctx    = canvas.getContext('2d');
  let W, H, pts = [];

  /* Ajusta el canvas al tamaño de la ventana y reconstruye hexágonos */
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    build();
  }

  /* Genera posiciones y propiedades de cada hexágono */
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

  /* Traza el contorno de un hexágono */
  function hexPath(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30);
      i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
              : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
  }

  /* Bucle de animación principal */
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
   SECCIÓN 2 — ACCIONES
================================================================ */

/* ----------------------------------------------------------------
   regresar()
   Llamada por: <button onclick="regresar()"> en opciones.html
   Navega de vuelta al menú principal.
   La ruta '../index.html' sube un nivel desde /opciones/
---------------------------------------------------------------- */
function regresar() {
  window.location.href = '../index.html'; /* ← conecta con index.html (menú principal) */
}


/* ================================================================
   SECCIÓN 3 — FUTURAS OPCIONES (pendiente de implementar)
   Aquí irán las funciones de configuración cuando se desarrollen.

   Ejemplos futuros:

   function setVolumenMusica(valor) {
     localStorage.setItem('ew_vol_musica', valor);
     // aplicar al objeto de audio del juego
   }

   function setCalidadGraficos(nivel) {
     localStorage.setItem('ew_graficos', nivel);
     // ajustar animaciones del fondo, efectos, etc.
   }

   function setIdioma(codigo) {
     localStorage.setItem('ew_idioma', codigo);
     // recargar textos de la interfaz
   }
================================================================ */
