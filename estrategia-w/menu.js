/* ================================================================
   menu.js — Lógica del menú de inicio de Estrategia W
   Referenciado en: index.html  (<script src="menu.js"></script>)
   Se carga al final del <body> para garantizar que el DOM
   ya esté construido cuando este script se ejecute.

   Contiene:
     1. Animación del fondo hexagonal  (canvas #bg)
     2. Función accion()               (botones del menú)
================================================================ */


/* ================================================================
   SECCIÓN 1 — FONDO HEXAGONAL ANIMADO
   Dibuja una cuadrícula de hexágonos con brillo pulsante
   sobre el elemento <canvas id="bg"> definido en index.html.
   El canvas se posiciona y estiliza mediante menu.css.
================================================================ */
(function () {

  /* -- Referencias al canvas y su contexto de dibujo 2D ----------
     'bg' es el id del <canvas> en index.html
  ---------------------------------------------------------------- */
  const canvas = document.getElementById('bg'); /* ← conecta con index.html */
  const ctx    = canvas.getContext('2d');

  /* Variables de tamaño y lista de puntos hexagonales */
  let W, H, pts = [];


  /* ----------------------------------------------------------------
     resize()
     Se llama al iniciar y cada vez que el usuario cambia el tamaño
     de la ventana. Ajusta el canvas al tamaño actual de la pantalla
     y regenera la cuadrícula hexagonal.
     Evento conectado abajo: window.addEventListener('resize', resize)
  ---------------------------------------------------------------- */
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    build(); /* Regenera los puntos después de cambiar tamaño */
  }


  /* ----------------------------------------------------------------
     build()
     Calcula las posiciones (x, y) de cada hexágono en pantalla
     y les asigna propiedades aleatorias de animación.
     Guarda todos los puntos en el arreglo `pts`.

     Propiedades de cada punto:
       x, y   → posición en el canvas
       base   → valor base aleatorio (sin uso directo, reservado)
       speed  → velocidad del pulso de brillo
       phase  → desfase de onda para que no pulsen todos igual
  ---------------------------------------------------------------- */
  function build() {
    pts = [];
    const cols = Math.ceil(W / 60) + 2;
    const rows = Math.ceil(H / 52) + 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        /* Offset horizontal en filas impares → patrón hexagonal real */
        const x = c * 60 + (r % 2 === 0 ? 0 : 30);
        const y = r * 52;

        pts.push({
          x, y,
          base:  Math.random(),
          speed: .0004 + Math.random() * .0006,
          phase: Math.random() * Math.PI * 2
        });
      }
    }
  }


  /* ----------------------------------------------------------------
     hexPath(cx, cy, r)
     Traza el contorno de un hexágono regular en el canvas.
     Parámetros:
       cx, cy → centro del hexágono
       r      → radio (tamaño)
     No dibuja por sí solo; usar ctx.stroke() después de llamarla.
  ---------------------------------------------------------------- */
  function hexPath(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30); /* Ángulo de cada vértice */
      i === 0
        ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
        : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
  }


  /* ----------------------------------------------------------------
     draw()
     Bucle de animación principal del fondo.
     Se llama a sí misma con requestAnimationFrame (~60 fps).
     En cada frame:
       1. Limpia el canvas
       2. Calcula la opacidad pulsante de cada hexágono con seno
       3. Dibuja todos los hexágonos

     La opacidad de cada hex oscila con Math.sin() usando su
     propio speed y phase para crear el efecto de "respiración".
  ---------------------------------------------------------------- */
  let t = 0;
  function draw() {
    t++;
    ctx.clearRect(0, 0, W, H);

    for (const p of pts) {
      /* Opacidad oscilante entre ~0.04 y ~0.10 */
      const alpha = .04 + .06 * (.5 + .5 * Math.sin(t * p.speed * 60 + p.phase));

      ctx.strokeStyle = `rgba(201,168,76,${alpha})`; /* Color dorado: var(--gold) en menu.css */
      ctx.lineWidth   = .6;
      hexPath(p.x, p.y, 26); /* Radio 26px por hexágono */
      ctx.stroke();
    }

    requestAnimationFrame(draw); /* Llama al siguiente frame */
  }


  /* ----------------------------------------------------------------
     INICIALIZACIÓN DEL FONDO
     1. Escucha cambios de tamaño de ventana
     2. Ejecuta resize() una vez al cargar (construye la cuadrícula)
     3. Arranca el bucle de animación con draw()
  ---------------------------------------------------------------- */
  window.addEventListener('resize', resize);
  resize(); /* Primera construcción del canvas */
  draw();   /* Arranca la animación */

})(); /* IIFE: se ejecuta inmediatamente y no contamina el scope global */


/* ================================================================
   SECCIÓN 2 — ACCIONES DEL MENÚ
   Función global llamada por los botones en index.html:
     <button onclick="accion('nuevo')">
     <button onclick="accion('cargar')">
     <button onclick="accion('opciones')">
================================================================ */

/* ----------------------------------------------------------------
   accion(tipo)
   Punto de entrada central para la navegación del menú.
   Parámetros:
     tipo → string que indica qué botón fue presionado:
              'nuevo'    → navega a nueva-partida/nueva-partida.html
              'cargar'   → navega a cargar-partida/cargar-partida.html
              'opciones' → (pendiente de implementar)
---------------------------------------------------------------- */
function accion(tipo) {

  if (tipo === 'nuevo') {
    /* Navega a la carpeta nueva-partida/ (relativa a index.html)
       Archivo destino: nueva-partida/nueva-partida.html */
    window.location.href = 'nueva-partida/nueva-partida.html';
  }

  else if (tipo === 'cargar') {
    /* Navega a la carpeta cargar-partida/ (relativa a index.html)
       Archivo destino: cargar-partida/cargar-partida.html
       Esa pantalla leerá 'ew_partidas' de localStorage automáticamente */
    window.location.href = 'cargar-partida/cargar-partida.html';
  }

  else if (tipo === 'opciones') {
    /* Navega a la carpeta opciones/ (relativa a index.html)
       Archivo destino: opciones/opciones.html
       Por ahora muestra pantalla de mantenimiento. */
    window.location.href = 'opciones/opciones.html';
  }

  else {
    console.warn(`Acción desconocida: ${tipo}`);
  }
}
