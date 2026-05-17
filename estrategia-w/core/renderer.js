/* ================================================================
   renderer.js — Motor de renderizado 2D plano con scroll infinito
   Carpeta: /core/
   Cargado por: juego.html después de world-gen.js

   Responsabilidad: tomar WorldData de WorldGen.generar() y
   dibujarlo como un mapa 2D plano con scroll y zoom.

   Características:
     - Mapa hexagonal 2D canvas puro (sin Three.js)
     - Scroll libre con drag (mouse y touch)
     - Zoom con rueda / pinch
     - Scroll infinito horizontal (wrapping tipo Civilization)
     - Click en hexágono → evento 'hexClick'

   API pública:
     Renderer.init(canvasId, worldData)
     Renderer.destruir()
     Renderer.obtenerHex(q, r)
     Renderer.resaltarHex(q, r, color)
     Renderer.limpiarResaltados()
================================================================ */

const Renderer = (function () {

  /* ── Estado interno ── */
  let _canvas, _ctx, _world, _animId;

  let _cam = { x: 0, y: 0, zoom: 1.0, zoomMin: 0.6, zoomMax: 3.0 };

  let _drag = { activo: false, startX: 0, startY: 0,
                camStartX: 0, camStartY: 0, velX: 0, velY: 0 };

  let _pinchDist = 0;

  /* Tamaño base del hexágono (radio, flat-top) */
  const HEX_R = 32;

  let _resaltados = new Map(); /* "q,r" → color CSS */
  let _hexMap     = new Map(); /* "q,r" → hex object */
  let _hexPos     = new Map(); /* "q,r" → {px, py} píxeles sin zoom */
  let _mapaW = 0, _mapaH = 0;

  /* Colores base de terreno (sobreescribibles por mods via Registry) */
  const COLORES = {
    agua:    '#1a3a6e',
    tierra:  '#3d7a4a',
    costa:   '#6aaa78',
    montana: '#7a7a7a'
  };


  /* ================================================================
     INICIALIZACIÓN
  ================================================================ */

  function init(canvasId, worldData) {
    _world  = worldData;
    _canvas = document.getElementById(canvasId);
    _ctx    = _canvas.getContext('2d');

    _world.hexagonos.forEach(h => _hexMap.set(`${h.q},${h.r}`, h));

    _calcularPosiciones();
    _centrarCamara();
    _configurarInteraccion();
    _loop();

    console.log('[Renderer2D] Listo. Mapa:', Math.round(_mapaW), 'x', Math.round(_mapaH), 'px');
  }


  /* ================================================================
     POSICIONES 2D
     Hexágono flat-top:
       px = R * 3/2 * q
       py = R * √3 * (r + q/2)
  ================================================================ */

  function _calcularPosiciones() {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    /* Primera pasada: posiciones brutas */
    _world.hexagonos.forEach(h => {
      const px = HEX_R * 1.5 * h.q;
      const py = HEX_R * Math.sqrt(3) * (h.r + h.q / 2);
      _hexPos.set(`${h.q},${h.r}`, { px, py });
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    });

    /* Segunda pasada: normalizar a (padding, padding) */
    const pad = HEX_R * 2;
    _hexPos.forEach(pos => {
      pos.px = pos.px - minX + pad;
      pos.py = pos.py - minY + pad;
    });

    _mapaW = (maxX - minX) + pad * 2;
    _mapaH = (maxY - minY) + pad * 2;
  }


  /* ================================================================
     CÁMARA
  ================================================================ */

  function _centrarCamara() {
    _sincronizarCanvas();
    _cam.x = (_canvas.width  - _mapaW * _cam.zoom) / 2;
    _cam.y = (_canvas.height - _mapaH * _cam.zoom) / 2;
  }

  function _sincronizarCanvas() {
    const W = _canvas.clientWidth  || window.innerWidth;
    const H = _canvas.clientHeight || window.innerHeight;
    if (_canvas.width !== W || _canvas.height !== H) {
      _canvas.width  = W;
      _canvas.height = H;
    }
  }

  /* Límite horizontal: no salir del mapa por los lados */
  function _wrapHorizontal() {
    const W  = _canvas.width;
    const mw = _mapaW * _cam.zoom;
    const mar = 120;
    if (_cam.x > mar)           _cam.x = mar;
    if (_cam.x < W - mw - mar) _cam.x = W - mw - mar;
  }

  /* Límite vertical suave */
  function _limitarVertical() {
    const H   = _canvas.height;
    const mh  = _mapaH * _cam.zoom;
    const mar = 120;
    if (_cam.y > mar)           _cam.y = mar;
    if (_cam.y < H - mh - mar) _cam.y = H - mh - mar;
  }


  /* ================================================================
     DIBUJADO
  ================================================================ */

  function _dibujar() {
    const W = _canvas.width;
    const H = _canvas.height;

    /* Fondo */
    _ctx.fillStyle = '#05080f';
    _ctx.fillRect(0, 0, W, H);

    /* Dibujar solo el mapa central */
    _dibujarCopia(_cam.x, _cam.y);
  }

  function _dibujarCopia(ox, oy) {
    const W = _canvas.width;
    const H = _canvas.height;
    const z = _cam.zoom;
    const r = HEX_R * z;

    _world.hexagonos.forEach(hex => {
      const pos = _hexPos.get(`${hex.q},${hex.r}`);
      if (!pos) return;

      const sx = ox + pos.px * z;
      const sy = oy + pos.py * z;

      /* Culling por hexágono */
      if (sx + r < 0 || sx - r > W || sy + r < 0 || sy - r > H) return;

      const resalto = _resaltados.get(`${hex.q},${hex.r}`);
      const color   = resalto || COLORES[hex.terreno.id] || '#555';

      _dibujarHex(sx, sy, r, color);
    });
  }

  function _dibujarHex(cx, cy, r, color) {
    _ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i; /* flat-top: empieza en 0° */
      i === 0
        ? _ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
        : _ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    _ctx.closePath();
    _ctx.fillStyle = color;
    _ctx.fill();
    _ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    _ctx.lineWidth   = Math.max(0.5, r * 0.06);
    _ctx.stroke();
  }


  /* ================================================================
     LOOP
  ================================================================ */

  function _loop() {
    _sincronizarCanvas();

    /* Inercia */
    if (!_drag.activo) {
      _cam.x    += _drag.velX;
      _cam.y    += _drag.velY;
      _drag.velX *= 0.87;
      _drag.velY *= 0.87;
    }

    _wrapHorizontal();
    _limitarVertical();
    _dibujar();

    _animId = requestAnimationFrame(_loop);
  }


  /* ================================================================
     INTERACCIÓN
  ================================================================ */

  function _configurarInteraccion() {

    /* MOUSE DOWN */
    _canvas.addEventListener('mousedown', e => {
      _drag.activo    = true;
      _drag.startX    = e.clientX;
      _drag.startY    = e.clientY;
      _drag.camStartX = _cam.x;
      _drag.camStartY = _cam.y;
      _drag.velX      = 0;
      _drag.velY      = 0;
      _canvas.style.cursor = 'grabbing';
    });

    /* MOUSE MOVE */
    window.addEventListener('mousemove', e => {
      if (!_drag.activo) return;
      const dx   = e.clientX - _drag.startX;
      const dy   = e.clientY - _drag.startY;
      _drag.velX = dx - (_cam.x - _drag.camStartX);
      _drag.velY = dy - (_cam.y - _drag.camStartY);
      _cam.x     = _drag.camStartX + dx;
      _cam.y     = _drag.camStartY + dy;
    });

    /* MOUSE UP → también detecta click */
    window.addEventListener('mouseup', e => {
      if (!_drag.activo) return;
      _drag.activo         = false;
      _canvas.style.cursor = 'grab';
      const dx = Math.abs(e.clientX - _drag.startX);
      const dy = Math.abs(e.clientY - _drag.startY);
      if (dx < 5 && dy < 5) _detectarClick(e.clientX, e.clientY);
    });

    _canvas.style.cursor = 'grab';

    /* ZOOM con rueda */
    _canvas.addEventListener('wheel', e => {
      e.preventDefault();
      _zoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY);
    }, { passive: false });

    /* TOUCH */
    _canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        _drag.activo    = true;
        _drag.startX    = e.touches[0].clientX;
        _drag.startY    = e.touches[0].clientY;
        _drag.camStartX = _cam.x;
        _drag.camStartY = _cam.y;
        _drag.velX = _drag.velY = 0;
      } else if (e.touches.length === 2) {
        _pinchDist = _dist2(e.touches);
      }
    }, { passive: true });

    _canvas.addEventListener('touchmove', e => {
      if (e.touches.length === 1 && _drag.activo) {
        _cam.x = _drag.camStartX + e.touches[0].clientX - _drag.startX;
        _cam.y = _drag.camStartY + e.touches[0].clientY - _drag.startY;
      } else if (e.touches.length === 2) {
        const d   = _dist2(e.touches);
        const cx  = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy  = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        _zoom(d > _pinchDist ? 1.04 : 0.96, cx, cy);
        _pinchDist = d;
      }
    }, { passive: true });

    _canvas.addEventListener('touchend', e => {
      _drag.activo = false;
      if (e.changedTouches.length === 1) {
        const dx = Math.abs(e.changedTouches[0].clientX - _drag.startX);
        const dy = Math.abs(e.changedTouches[0].clientY - _drag.startY);
        if (dx < 8 && dy < 8)
          _detectarClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    }, { passive: true });
  }

  /* Zoom centrado en el punto pivote */
  function _zoom(factor, px, py) {
    const prev = _cam.zoom;
    _cam.zoom  = Math.max(_cam.zoomMin, Math.min(_cam.zoomMax, _cam.zoom * factor));
    const esc  = _cam.zoom / prev;
    _cam.x     = px - (px - _cam.x) * esc;
    _cam.y     = py - (py - _cam.y) * esc;
  }

  function _dist2(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  /* ----------------------------------------------------------------
     _detectarClick(clientX, clientY)
     Busca el hexágono más cercano al punto clickeado,
     buscando en las 3 copias del mapa (scroll infinito).
  ---------------------------------------------------------------- */
  function _detectarClick(clientX, clientY) {
    const rect = _canvas.getBoundingClientRect();
    const sx   = clientX - rect.left;
    const sy   = clientY - rect.top;
    const z    = _cam.zoom;
    const r    = HEX_R * z;

    let mejorHex  = null;
    let mejorDist = Infinity;

    _world.hexagonos.forEach(hex => {
      const pos = _hexPos.get(`${hex.q},${hex.r}`);
      if (!pos) return;
      const hx   = _cam.x + pos.px * z;
      const hy   = _cam.y + pos.py * z;
      const dist = Math.hypot(sx - hx, sy - hy);
      if (dist < r && dist < mejorDist) {
        mejorDist = dist;
        mejorHex  = hex;
      }
    });

    if (mejorHex) {
      _canvas.dispatchEvent(new CustomEvent('hexClick', {
        detail: { q: mejorHex.q, r: mejorHex.r,
                  terreno: mejorHex.terreno, hex: mejorHex },
        bubbles: true
      }));
    }
  }


  /* ================================================================
     API PÚBLICA
  ================================================================ */

  function resaltarHex(q, r, color) {
    /* Acepta número hex de Three.js o string CSS */
    const css = typeof color === 'number'
      ? '#' + color.toString(16).padStart(6, '0')
      : color;
    _resaltados.set(`${q},${r}`, css);
  }

  function limpiarResaltados() { _resaltados.clear(); }

  function obtenerHex(q, r) { return _hexMap.get(`${q},${r}`) || null; }

  function destruir() {
    if (_animId) cancelAnimationFrame(_animId);
    _hexMap.clear(); _hexPos.clear(); _resaltados.clear();
    _ctx && _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    console.log('[Renderer2D] Destruido.');
  }

  return { init, destruir, resaltarHex, limpiarResaltados, obtenerHex };

})();
