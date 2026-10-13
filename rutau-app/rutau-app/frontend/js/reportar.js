/* Reportar un problema del servicio. */
(async function () {
  'use strict';
  var h = A11y.h;

  Auth.activarSalir();
  try { if (!(await Auth.exigirSesion())) return; } catch (e) { return; }

  var form = document.getElementById('form-reporte');
  var resumen = document.getElementById('resumen-reporte');
  var selRuta = document.getElementById('ruta');
  var descripcion = document.getElementById('descripcion');
  var contador = document.getElementById('contador');
  var confirmacion = document.getElementById('confirmacion');

  A11y.vigilar(form);

  try {
    (await Api.rutas()).rutas.forEach(function (r) {
      selRuta.append(h('option', { value: r.id, texto: r.nombre }));
    });
  } catch (e) {
    A11y.mostrarErrores(form, {}, resumen, e.message);
    return;
  }

  descripcion.addEventListener('input', function () { contador.textContent = descripcion.value.length + '/300'; });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var tipo = form.querySelector('input[name="tipo"]:checked');
    var datos = { tipo: tipo ? tipo.value : '', ruta: selRuta.value, descripcion: descripcion.value.trim() };
    var errores = {};
    if (!datos.tipo) errores.tipo = 'Elige qué tipo de problema ocurrió.';
    if (!datos.ruta) errores.ruta = 'Elige la ruta donde ocurrió.';
    if (datos.descripcion.length < 15) errores.descripcion = 'Escribe al menos 15 caracteres para describir el problema.';
    if (Object.keys(errores).length) return A11y.mostrarErrores(form, errores, resumen);

    A11y.limpiarErrores(form, resumen);
    var boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'Enviando…';
    try {
      var r = (await Api.crearReporte(datos)).reporte;
      form.hidden = true;
      document.getElementById('folio').textContent = r.folio;
      document.getElementById('conf-detalle').replaceChildren(
        h('div', null, h('dt', { texto: 'Tipo' }), h('dd', { texto: r.tipo })),
        h('div', null, h('dt', { texto: 'Ruta' }), h('dd', { texto: r.ruta })),
        h('div', null, h('dt', { texto: 'Descripción' }), h('dd', { texto: r.descripcion }))
      );
      confirmacion.hidden = false;
      A11y.enfocar(document.getElementById('conf-titulo'));
      A11y.anunciar('Reporte enviado. Tu folio es ' + r.folio + '.');
    } catch (err) {
      boton.disabled = false;
      boton.textContent = 'Enviar reporte';
      A11y.mostrarErrores(form, err.campos || {}, resumen, err.campos ? null : err.message);
    }
  });

  document.getElementById('otro').addEventListener('click', function () {
    form.reset();
    contador.textContent = '0/300';
    var boton = form.querySelector('button[type="submit"]');
    boton.disabled = false;
    boton.textContent = 'Enviar reporte';
    confirmacion.hidden = true;
    form.hidden = false;
    A11y.enfocar(document.getElementById('titulo-reportar'));
  });
})();
