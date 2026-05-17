/* ================================================================
   world-gen.js — Generador procedural del mundo
   Carpeta: /core/
   Cargado por: juego.html antes que renderer.js y juego.js

   Responsabilidad ÚNICA: generar los DATOS del mundo.
   No dibuja nada. No conoce Three.js. No conoce el DOM.
   Solo produce un objeto WorldData que renderer.js consume.

   El mundo es una cuadrícula hexagonal proyectada sobre una esfera.
   Cada hexágono tiene coordenadas esféricas (lat, lon) y un tipo
   de terreno genérico que los mods pueden reemplazar.

   API pública:
     WorldGen.generar(config) → WorldData
     WorldGen.TAMANOS         → tabla de tamaños disponibles
================================================================ */

const WorldGen = (function () {

  /* ================================================================
     TABLA DE TAMAÑOS
     radio → número de anillos de hexágonos desde el centro de la isla.
     Leída por seleccion-mods.js para mostrar las descripciones.
     Referenciada en juego.js al llamar WorldGen.generar()
  ================================================================ */
  const TAMANOS = {
    pequeno: { radio: 8,  label: 'Pequeño',  hexCount: '~200'  },
    mediano: { radio: 13, label: 'Mediano',  hexCount: '~500'  },
    grande:  { radio: 18, label: 'Grande',   hexCount: '~1000' }
  };


  /* ================================================================
     TIPOS DE TERRENO GENÉRICO
     El motor solo conoce estos tipos base.
     Los mods pueden añadir tipos nuevos o reemplazar la apariencia
     registrando en Registry.registrarTerreno(id, config)

     color      → color base cuando no hay mod de texturas activo
     esAgua     → true si las unidades no pueden moverse aquí
     esTransitable → si las tropas/ciudades pueden estar aquí
  ================================================================ */
  const TERRENOS = {
    agua:    { id: 'agua',    color: 0x1a3a5c, esAgua: true,  esTransitable: false },
    tierra:  { id: 'tierra',  color: 0x4a7c59, esAgua: false, esTransitable: true  },
    costa:   { id: 'costa',   color: 0x8aab78, esAgua: false, esTransitable: true  },
    montaña: { id: 'montana', color: 0x6b6b6b, esAgua: false, esTransitable: false }
  };


  /* ================================================================
     GENERADOR DE NÚMEROS PSEUDOALEATORIOS (PRNG)
     Basado en semilla para que el mismo seed genere siempre
     el mismo mundo. Esto permite compartir mundos por código.
     Algoritmo: mulberry32 (rápido, buena distribución)
  ================================================================ */

  /* ----------------------------------------------------------------
     crearRNG(semilla)
     Retorna una función rand() que da números [0, 1) deterministas.
     Parámetros:
       semilla → número entero, la "firma" del mundo
  ---------------------------------------------------------------- */
  function crearRNG(semilla) {
    let s = semilla >>> 0;
    return function rand() {
      s += 0x6D2B79F5;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }


  /* ================================================================
     COORDENADAS DE HEXÁGONOS EN CUADRÍCULA AXIAL
     Sistema axial (q, r) estándar para hexágonos flat-top.
     Cada hexágono se identifica por su par (q, r).
  ================================================================ */

  /* ----------------------------------------------------------------
     vecinosAxiales(q, r)
     Retorna los 6 hexágonos vecinos de (q, r) en coordenadas axiales.
  ---------------------------------------------------------------- */
  function vecinosAxiales(q, r) {
    return [
      [q+1, r], [q-1, r],
      [q, r+1], [q, r-1],
      [q+1, r-1], [q-1, r+1]
    ];
  }

  /* ----------------------------------------------------------------
     distanciaAxial(q1, r1, q2, r2)
     Distancia en pasos entre dos hexágonos en coordenadas axiales.
     Usada para definir el contorno circular de la isla.
  ---------------------------------------------------------------- */
  function distanciaAxial(q1, r1, q2, r2) {
    return (Math.abs(q1 - q2) +
            Math.abs(q1 + r1 - q2 - r2) +
            Math.abs(r1 - r2)) / 2;
  }


  /* ================================================================
     PROYECCIÓN ESFÉRICA
     Convierte coordenadas axiales (q, r) a posición 3D sobre
     la superficie de una esfera de radio R.

     El proceso es:
       1. (q, r) axial → (x, y) plano 2D (posición en el mapa plano)
       2. (x, y) plano → (lat, lon) esféricas usando proyección
       3. (lat, lon) → (X, Y, Z) cartesianas en la esfera
  ================================================================ */

  /* ----------------------------------------------------------------
     axialA3D(q, r, radioIsla, radioEsfera)
     Convierte un hexágono axial (q, r) a coordenadas 3D (x, y, z)
     sobre la superficie de la esfera.
     Parámetros:
       q, r        → coordenadas axiales del hexágono
       radioIsla   → radio máximo de la isla en hexágonos
       radioEsfera → radio de la esfera 3D (unidades Three.js)
  ---------------------------------------------------------------- */
  function axialA3D(q, r, radioIsla, radioEsfera) {
    /* Paso 1: axial → plano 2D (hex flat-top) */
    const px = (3/2) * q;
    const py = Math.sqrt(3) * (r + q/2);

    /* Paso 2: normalizar a [-1, 1] según el radio de la isla */
    const escala = radioIsla * 1.8;
    const nx = px / escala;
    const ny = py / escala;

    /* Clamp para no salir de la esfera */
    const dist = Math.sqrt(nx*nx + ny*ny);
    const distSafe = Math.min(dist, 0.98);

    /* Paso 3: proyección esférica (Lambert azimuthal) */
    const lat = Math.asin(distSafe) * (dist > 0 ? distSafe/dist : 1) * (Math.PI/2);
    const lon = Math.atan2(ny, nx);

    /* Paso 4: esféricas → cartesianas */
    const cosLat = Math.cos(lat);
    return {
      x: radioEsfera * cosLat * Math.cos(lon),
      y: radioEsfera * Math.sin(lat),
      z: radioEsfera * cosLat * Math.sin(lon)
    };
  }


  /* ================================================================
     GENERACIÓN DE LA ISLA
     Algoritmo:
       1. Crear todos los hexágonos dentro del radio
       2. Aplicar ruido para hacer la costa irregular
       3. Asignar tipos de terreno (agua/costa/tierra/montaña)
       4. Convertir cada hexágono a posición 3D
  ================================================================ */

  /* ----------------------------------------------------------------
     generarIsla(radio, rand)
     Genera el array de hexágonos que forman la isla.
     Parámetros:
       radio → radio en hexágonos (del tamaño elegido)
       rand  → función RNG seeded
     Retorna:
       Array de objetos hexágono con { q, r, terreno, pos3D, vecinos }
  ---------------------------------------------------------------- */
  function generarIsla(radio, rand, radioEsfera) {
    const hexMap = new Map(); /* clave: "q,r" → objeto hex */

    /* ── Paso 1: generar todos los hexágonos en el radio ── */
    for (let q = -radio; q <= radio; q++) {
      for (let r = -radio; r <= radio; r++) {
        if (distanciaAxial(0, 0, q, r) <= radio) {
          hexMap.set(`${q},${r}`, { q, r, terreno: null, pos3D: null });
        }
      }
    }

    /* ── Paso 2: aplicar ruido para definir tierra vs agua ──
       Cada hexágono tiene una probabilidad de ser tierra basada
       en su distancia al centro + ruido pseudoaleatorio.
       Más cerca del centro = más probable que sea tierra. */
    const radioIsla = radio * 0.72; /* La isla ocupa ~72% del radio total */

    hexMap.forEach((hex, key) => {
      const dist   = distanciaAxial(0, 0, hex.q, hex.r);
      const ruido  = (rand() - 0.5) * radio * 0.45;
      const esTierra = (dist + ruido) < radioIsla;

      hex.esTierra = esTierra;
    });

    /* ── Paso 3: asignar tipos de terreno ── */
    hexMap.forEach((hex) => {
      if (!hex.esTierra) {
        hex.terreno = TERRENOS.agua;
        return;
      }

      /* ¿Es costa? Si algún vecino es agua, es costa */
      const esCostaHex = vecinosAxiales(hex.q, hex.r).some(([vq, vr]) => {
        const v = hexMap.get(`${vq},${vr}`);
        return !v || !v.esTierra; /* Vecino fuera del mapa o agua */
      });

      if (esCostaHex) {
        hex.terreno = TERRENOS.costa;
        return;
      }

      /* ¿Es montaña? Hexágonos interiores con probabilidad basada en RNG */
      const dist = distanciaAxial(0, 0, hex.q, hex.r);
      const probMontana = rand();
      /* Más montañas en el interior */
      if (probMontana < 0.15 && dist < radioIsla * 0.6) {
        hex.terreno = TERRENOS.montaña;
      } else {
        hex.terreno = TERRENOS.tierra;
      }
    });

    /* ── Paso 4: calcular posición 3D de cada hexágono ── */
    hexMap.forEach((hex) => {
      hex.pos3D = axialA3D(hex.q, hex.r, radio, radioEsfera);
    });

    /* ── Paso 5: guardar referencias a vecinos ── */
    hexMap.forEach((hex) => {
      hex.vecinos = vecinosAxiales(hex.q, hex.r)
        .map(([vq, vr]) => hexMap.get(`${vq},${vr}`))
        .filter(Boolean);
    });

    return Array.from(hexMap.values());
  }


  /* ================================================================
     API PÚBLICA
  ================================================================ */

  /* ----------------------------------------------------------------
     generar(config)
     Función principal. Genera el mundo completo y retorna WorldData.
     Llamada por juego.js al iniciar la partida.

     Parámetros (config):
       tamano      → 'pequeno' | 'mediano' | 'grande'
       semilla     → número entero (opcional, se genera si no se da)
       radioEsfera → radio visual de la esfera en Three.js (default: 5)

     Retorna WorldData:
       {
         semilla,          ← semilla usada (para guardar/compartir)
         tamano,           ← string del tamaño
         radioEsfera,      ← radio de la esfera Three.js
         hexagonos[],      ← array completo de hexágonos
         TERRENOS,         ← referencia a la tabla de terrenos
         meta: {           ← estadísticas del mundo generado
           totalHex,
           hexTierra,
           hexAgua,
           hexCosta,
           hexMontana
         }
       }

     Leído por:
       renderer.js → para dibujar la esfera
       juego.js    → para guardar la semilla en la partida
       mods        → para añadir estructuras sobre los hexágonos
  ---------------------------------------------------------------- */
  function generar(config = {}) {
    const tamano      = config.tamano      || 'mediano';
    const semilla     = config.semilla     || Math.floor(Math.random() * 999999);
    const radioEsfera = config.radioEsfera || 5;

    /* Validar tamaño */
    const cfg = TAMANOS[tamano] || TAMANOS.mediano;
    const radio = cfg.radio;

    console.log(`[WorldGen] Generando mundo: tamano=${tamano} radio=${radio} semilla=${semilla}`);

    /* Crear RNG seeded */
    const rand = crearRNG(semilla);

    /* Generar hexágonos */
    const hexagonos = generarIsla(radio, rand, radioEsfera);

    /* Calcular estadísticas */
    const meta = {
      totalHex:   hexagonos.length,
      hexTierra:  hexagonos.filter(h => h.terreno.id === 'tierra').length,
      hexAgua:    hexagonos.filter(h => h.terreno.id === 'agua').length,
      hexCosta:   hexagonos.filter(h => h.terreno.id === 'costa').length,
      hexMontana: hexagonos.filter(h => h.terreno.id === 'montana').length
    };

    console.log(`[WorldGen] Mundo generado:`, meta);

    /* Retornar WorldData (consumido por renderer.js y juego.js) */
    return {
      semilla,
      tamano,
      radioEsfera,
      hexagonos,
      TERRENOS,
      meta
    };
  }

  /* Exponer API pública */
  return { generar, TAMANOS, TERRENOS };

})();
