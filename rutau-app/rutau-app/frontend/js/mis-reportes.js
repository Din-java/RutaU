/* Mis reportes: lista, filtro y retiro con confirmación. */
(async function () {
  'use strict';
  var h = A11y.h;

  Auth.activarSalir();
  try { if (!(await Auth.exigirSesion())) return; } catch (e) { return; }

  var lista = document.getElementById('lista');
  var titulo = document.getElementById('titulo-lista');
  var aviso = document.getElementById('aviso');
  var botones = { activos: document.getElementById('f-activos'), retirados: document.getElementById('f-retirados') };
  var dialogo = document.getElementById('dialogo-retirar');
  var textoDialogo = document.getElementById('dialogo-texto');
  var confirmar = document.getElementById('confirmar-retirar');

  var reportes = [];
  var filtro = 'activos';
  var pendiente = null;

  function render() {
    var activos = reportes.filter(function (r) { return r.estado !== 'retirado'; });
    var retirados = reportes.filter(function (r) { return r.estado === 'retirado'; });
    botones.activos.textContent = 'Activos (' + activos.length + ')';
    botones.retirados.textContent = 'Retirados (' + retirados.length + ')';
    botones.activos.setAttribute('aria-pressed', String(filtro === 'activos'));
    botones.retirados.setAttribute('aria-pressed', String(filtro === 'retirados'));
    titulo.textContent = filtro === 'activos' ? 'Reportes activos' : 'Reportes retirados';

    var visibles = filtro === 'activos' ? activos : retirados;
    if (!visibles.length) {
      lista.replaceChildren(h('div', { clase: 'vacio' },
        h('p', { texto: filtro === 'activos' ? 'No tienes reportes activos.' : 'No has retirado ningún reporte.' }),
        filtro === 'activos' ? h('a', { clase: 'btn primario', href: 'reportar.html', texto: 'Reportar un problema' }) : null));
      return;
    }
    lista.replaceChildren(h('ul', { clase: 'lista-citas' }, visibles.map(tarjeta)));
  }

  function tarjeta(r) {
    var retirado = r.estado === 'retirado';
    return h('li', { clase: 'cita' },
      h('div', { clase: 'cita-fila' },
        h('h3', null, r.folio + ' · ' + r.tipo),
        h('span', { clase: 'estado ' + (retirado ? 'estado-retirado' : 'estado-recibido'), texto: retirado ? 'Retirado' : 'Recibido' })),
      h('p', { clase: 'meta' }, r.ruta + ' · ', h('time', { datetime: r.creado, texto: Api.fechaHora(r.creado) })),
      h('p', { clase: 'motivo', texto: r.descripcion }),
      retirado ? null : h('button', {
        type: 'button', clase: 'btn peligro',
        'aria-label': 'Retirar el reporte ' + r.folio,
        onclick: function () {
          pendiente = r;
          textoDialogo.textContent = 'Vas a retirar el reporte ' + r.folio + ' (' + r.tipo + ', ' + r.ruta + '). Dejará de contar como activo.';
          dialogo.showModal();
        },
        texto: 'Retirar reporte',
      }));
  }

  confirmar.addEventListener('click', async function () {
    var r = pendiente;
    confirmar.disabled = true;
    try {
      await Api.retirarReporte(r.id);
      r.estado = 'retirado';
      dialogo.close('retirado');
      render();
      aviso.textContent = 'Retiraste el reporte ' + r.folio + '.';
      aviso.hidden = false;
      A11y.anunciar(aviso.textContent);
      A11y.enfocar(titulo); // el botón pulsado ya no existe
    } catch (e) {
      dialogo.close('error');
      aviso.textContent = 'No se pudo retirar el reporte. ' + e.message;
      aviso.hidden = false;
      A11y.anunciar(aviso.textContent);
      A11y.enfocar(aviso);
    } finally {
      confirmar.disabled = false;
      pendiente = null;
    }
  });
  document.getElementById('conservar').addEventListener('click', function () { dialogo.close('conservar'); });

  function elegir(nuevo) { filtro = nuevo; aviso.hidden = true; render(); A11y.anunciar(titulo.textContent); }
  botones.activos.addEventListener('click', function () { elegir('activos'); });
  botones.retirados.addEventListener('click', function () { elegir('retirados'); });

  try {
    reportes = (await Api.reportes()).reportes;
    render();
  } catch (e) {
    lista.replaceChildren(h('p', { clase: 'error', texto: e.message }));
  }
})();
