/* Rutas: lista de rutas y detalle con paradas, posición del autobús y favoritas. */
(async function () {
  'use strict';
  var h = A11y.h;

  Auth.activarSalir();
  try { if (!(await Auth.exigirSesion())) return; } catch (e) { return; }

  var vistaLista = document.getElementById('vista-lista');
  var vistaDetalle = document.getElementById('vista-detalle');
  var id = new URLSearchParams(location.search).get('ruta');

  /* ---------- Lista de rutas ---------- */
  if (!id) {
    try {
      var rutas = (await Api.rutas()).rutas;
      document.getElementById('lista-rutas').replaceChildren.apply(document.getElementById('lista-rutas'), rutas.map(function (r) {
        return h('li', null, h('a', { clase: 'ruta-enlace', href: 'rutas.html?ruta=' + encodeURIComponent(r.id) },
          h('strong', null, h('span', { clase: 'tag', texto: r.codigo }), r.nombre),
          r.totalParadas + ' paradas · sale cada ' + r.frecuencia + ' min · hacia ' + r.destino));
      }));
    } catch (e) {
      document.getElementById('lista-rutas').replaceChildren(h('li', { clase: 'error', texto: e.message }));
    }
    vistaLista.hidden = false;
    return;
  }

  /* ---------- Detalle de una ruta ---------- */
  vistaDetalle.hidden = false;
  var titulo = document.getElementById('titulo-ruta');
  var estado = document.getElementById('estado-bus');
  var lista = document.getElementById('paradas');
  var aviso = document.getElementById('aviso');

  function textoLlegada(p) { return p.minutos === 0 ? 'Llega ahora' : 'Llega en ' + p.minutos + ' min'; }

  function filaParada(p) {
    var boton = h('button', { type: 'button', clase: 'btn', 'data-parada': p.id, 'data-nombre': p.nombre });
    ajustarBoton(boton, p.favorita);
    return h('li', { clase: 'parada' + (p.aqui ? ' aqui' : '') + (p.pasada ? ' pasada' : '') },
      h('span', { clase: 'nombre' }, p.nombre, p.aqui ? [' ', h('span', { clase: 'tag', texto: 'Autobús aquí' })] : null, h('small', { texto: textoLlegada(p) })),
      boton);
  }
  function ajustarBoton(boton, favorita) {
    var nombre = boton.getAttribute('data-nombre');
    boton.setAttribute('aria-pressed', String(favorita));
    boton.setAttribute('aria-label', (favorita ? 'Quitar ' : 'Guardar ') + nombre + (favorita ? ' de favoritas' : ' en favoritas'));
    boton.textContent = favorita ? 'Quitar' : 'Guardar';
  }

  async function cargar() {
    var d = await Api.ruta(id);
    titulo.replaceChildren(h('span', { clase: 'tag', texto: d.ruta.codigo }), d.ruta.nombre);
    document.title = d.ruta.nombre + ' – RutaU';
    estado.replaceChildren('Autobús en camino: está en ', h('strong', { texto: d.autobus.paradaActual }),
      '. Próxima salida desde la primera parada: ' + (d.autobus.proximaSalida === 0 ? 'ahora' : 'en ' + d.autobus.proximaSalida + ' min') + '.');
    lista.replaceChildren.apply(lista, d.paradas.map(filaParada));
  }

  try {
    await cargar();
  } catch (e) {
    titulo.textContent = e.estado === 404 ? 'No encontramos esa ruta' : 'No se pudo cargar la ruta';
    estado.hidden = true;
    lista.replaceChildren(h('li', { clase: 'error', texto: e.message }));
    return;
  }

  lista.addEventListener('click', async function (e) {
    var boton = e.target.closest('button[data-parada]');
    if (!boton) return;
    var quitar = boton.getAttribute('aria-pressed') === 'true';
    var nombre = boton.getAttribute('data-nombre');
    boton.disabled = true;
    try {
      if (quitar) await Api.quitarFavorita(boton.getAttribute('data-parada'));
      else await Api.guardarFavorita(boton.getAttribute('data-parada'));
      ajustarBoton(boton, !quitar);
      aviso.textContent = (quitar ? 'Quitaste ' : 'Guardaste ') + nombre + (quitar ? ' de favoritas.' : ' en favoritas.');
      aviso.hidden = false;
      A11y.anunciar(aviso.textContent);
    } catch (err) {
      aviso.textContent = err.message;
      aviso.hidden = false;
      A11y.anunciar(err.message);
    }
    boton.disabled = false;
    boton.focus();
  });

  setInterval(function () { if (!lista.contains(document.activeElement)) cargar().catch(function () {}); }, 30000);
})();
