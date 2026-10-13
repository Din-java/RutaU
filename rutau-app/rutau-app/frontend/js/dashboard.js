/* Panel: próximas salidas de mi parada y paradas favoritas. */
(async function () {
  'use strict';
  var h = A11y.h;

  Auth.activarSalir();
  var usuario;
  try { usuario = await Auth.exigirSesion(); } catch (e) { return; }
  if (!usuario) return;

  document.getElementById('saludo').textContent = 'Hola, ' + usuario.nombre.split(' ')[0];

  var selParada = document.getElementById('parada');
  var listaSalidas = document.getElementById('salidas');
  var botonFav = document.getElementById('btn-favorita');
  var aviso = document.getElementById('aviso');
  var avisoTexto = document.getElementById('aviso-texto');
  var deshacer = document.getElementById('aviso-deshacer');
  var cajaFavs = document.getElementById('favoritas');
  var accionDeshacer = null;
  var actual = null; // última respuesta de salidas

  function mostrarAviso(texto, alDeshacer) {
    avisoTexto.textContent = texto;
    accionDeshacer = alDeshacer || null;
    deshacer.hidden = !alDeshacer;
    aviso.hidden = false;
    A11y.anunciar(texto);
  }

  /* ---------- Salidas de la parada elegida ---------- */
  function pintarSalidas(datos) {
    actual = datos;
    listaSalidas.replaceChildren.apply(listaSalidas, datos.salidas.map(function (s) {
      return h('li', { clase: 'salida' },
        h('div', null,
          h('p', null, h('span', { clase: 'tag', texto: s.codigo }),
            h('a', { href: 'rutas.html?ruta=' + encodeURIComponent(s.rutaId), texto: s.ruta })),
          h('p', { clase: 'destino', texto: 'Hacia ' + s.destino })),
        h('span', { clase: 'minutos' }, s.minutos === 0 ? 'Ahora' : [String(s.minutos) + ' ', h('small', { texto: 'min' })])
      );
    }));
    if (!datos.salidas.length) listaSalidas.replaceChildren(h('li', { clase: 'ayuda', texto: 'Ninguna ruta pasa por esta parada.' }));
    botonFav.setAttribute('aria-pressed', String(datos.favorita));
    botonFav.textContent = datos.favorita ? 'Quitar de favoritas' : 'Guardar como favorita';
    botonFav.setAttribute('aria-label', (datos.favorita ? 'Quitar ' : 'Guardar ') + datos.parada.nombre + (datos.favorita ? ' de favoritas' : ' en favoritas'));
  }

  async function cargarSalidas(anunciar) {
    try {
      var datos = await Api.salidas(selParada.value);
      pintarSalidas(datos);
      if (anunciar) {
        var primera = datos.salidas[0];
        A11y.anunciar(primera ? 'Parada ' + datos.parada.nombre + '. Próximo autobús: ruta ' + primera.ruta + ', ' + Api.minutos(primera.minutos) + '.' : 'Ninguna ruta pasa por ' + datos.parada.nombre + '.');
      }
    } catch (e) {
      listaSalidas.replaceChildren(h('li', { clase: 'error', texto: e.message }));
    }
  }

  /* ---------- Favoritas ---------- */
  async function cargarFavoritas() {
    try {
      var favs = (await Api.favoritas()).favoritas;
      if (!favs.length) {
        cajaFavs.replaceChildren(h('p', { clase: 'ayuda', texto: 'Aún no tienes paradas favoritas. Elige una parada arriba y pulsa «Guardar como favorita».' }));
        return;
      }
      cajaFavs.replaceChildren.apply(cajaFavs, favs.map(function (f) {
        return h('div', { clase: 'fila-favorita' },
          h('div', null,
            h('h3', { texto: f.nombre }),
            h('p', { texto: f.siguiente ? 'Próximo: ruta ' + f.siguiente.ruta + ', ' + (f.siguiente.minutos === 0 ? 'ahora' : 'en ' + f.siguiente.minutos + ' min') : 'Sin salidas' })),
          h('div', { clase: 'acciones' },
            h('button', { type: 'button', clase: 'btn', 'aria-label': 'Ver salidas de ' + f.nombre, onclick: function () { selParada.value = f.id; cargarSalidas(true); A11y.enfocar(document.getElementById('titulo-salidas')); }, texto: 'Ver salidas' }),
            h('button', { type: 'button', clase: 'btn peligro', 'aria-label': 'Quitar ' + f.nombre + ' de favoritas', onclick: function () { quitar(f.id, f.nombre); }, texto: 'Quitar' }))
        );
      }));
    } catch (e) {
      cajaFavs.replaceChildren(h('p', { clase: 'error', texto: e.message }));
    }
  }

  async function guardar(id, nombre) {
    await Api.guardarFavorita(id);
    mostrarAviso('Guardaste ' + nombre + ' en favoritas.', function () { return quitar(id, nombre, true); });
  }
  async function quitar(id, nombre, silencioso) {
    await Api.quitarFavorita(id);
    if (silencioso) mostrarAviso('Quitaste ' + nombre + ' de favoritas.');
    else mostrarAviso('Quitaste ' + nombre + ' de favoritas.', function () { return guardar(id, nombre); });
    await refrescar();
    if (!silencioso) A11y.enfocar(document.getElementById('titulo-favoritas'));
  }
  async function refrescar() { await Promise.all([cargarSalidas(false), cargarFavoritas()]); }

  botonFav.addEventListener('click', async function () {
    botonFav.disabled = true;
    try {
      if (actual.favorita) await quitar(actual.parada.id, actual.parada.nombre);
      else { await guardar(actual.parada.id, actual.parada.nombre); await refrescar(); }
    } catch (e) { mostrarAviso(e.message); }
    botonFav.disabled = false;
    botonFav.focus();
  });
  deshacer.addEventListener('click', async function () {
    var accion = accionDeshacer;
    if (!accion) return;
    try { await accion(); await refrescar(); } catch (e) { mostrarAviso(e.message); }
    A11y.enfocar(botonFav);
  });

  /* ---------- Arranque ---------- */
  try {
    var paradas = (await Api.paradas()).paradas;
    paradas.forEach(function (p) { selParada.append(h('option', { value: p.id, texto: p.nombre })); });
    var favs = (await Api.favoritas()).favoritas;
    selParada.value = favs.length ? favs[0].id : (paradas.some(function (p) { return p.id === 'biblioteca'; }) ? 'biblioteca' : paradas[0].id);
  } catch (e) {
    listaSalidas.replaceChildren(h('li', { clase: 'error', texto: e.message }));
    return;
  }
  selParada.addEventListener('change', function () { cargarSalidas(true); });
  await refrescar();

  // Los tiempos se actualizan solos cada 30 s, salvo si el foco está dentro de la lista (para no quitarlo).
  setInterval(function () {
    if (!listaSalidas.contains(document.activeElement)) cargarSalidas(false);
    if (!cajaFavs.contains(document.activeElement)) cargarFavoritas();
  }, 30000);
})();
