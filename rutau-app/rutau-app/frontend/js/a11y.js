/* Utilidades de accesibilidad compartidas por todas las páginas. Se carga primero. */
(function () {
  'use strict';

  var raiz = document.documentElement;

  function leer(clave) { try { return localStorage.getItem(clave); } catch (e) { return null; } }
  function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento: la preferencia dura solo esta página */ } }

  /* ---------- Preferencias: texto grande y alto contraste ---------- */
  function preferenciaContraste() {
    var guardado = leer('cs-contraste');
    if (guardado) return guardado;
    return window.matchMedia && window.matchMedia('(prefers-contrast: more)').matches ? 'alto' : 'normal';
  }

  function aplicarPreferencias() {
    raiz.dataset.texto = leer('cs-texto') === 'grande' ? 'grande' : 'normal';
    raiz.dataset.contraste = preferenciaContraste() === 'alto' ? 'alto' : 'normal';
    var bTexto = document.getElementById('btn-texto');
    var bContraste = document.getElementById('btn-contraste');
    if (bTexto) bTexto.setAttribute('aria-pressed', String(raiz.dataset.texto === 'grande'));
    if (bContraste) bContraste.setAttribute('aria-pressed', String(raiz.dataset.contraste === 'alto'));
  }

  function alternar(botonId, clave, valorActivo, valorInactivo, atributo, mensajeOn, mensajeOff) {
    var boton = document.getElementById(botonId);
    if (!boton) return;
    boton.addEventListener('click', function () {
      var activar = raiz.dataset[atributo] !== valorActivo;
      guardar(clave, activar ? valorActivo : valorInactivo);
      aplicarPreferencias();
      anunciar(activar ? mensajeOn : mensajeOff);
    });
  }

  /* ---------- Región "en vivo" para avisos a lectores de pantalla ---------- */
  var region = null;
  function crearRegion() {
    region = document.getElementById('anuncios');
    if (!region) {
      region = document.createElement('div');
      region.id = 'anuncios';
      region.className = 'solo-lector';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
  }
  function anunciar(mensaje) {
    if (!region) crearRegion();
    region.textContent = '';
    // El retraso hace que el lector detecte el cambio aunque el texto se repita.
    setTimeout(function () { region.textContent = mensaje; }, 60);
  }

  /* ---------- Foco ---------- */
  function enfocar(elemento) {
    if (!elemento) return;
    // En un grupo de opciones (fieldset) se enfoca la opción marcada o la primera disponible,
    // para que las flechas del teclado funcionen de inmediato.
    if (elemento.tagName === 'FIELDSET') {
      var opcion = elemento.querySelector('input:checked:not(:disabled)') || elemento.querySelector('input:not(:disabled)');
      if (opcion) { opcion.focus(); return; }
    }
    if (!elemento.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(elemento.tagName)) {
      elemento.setAttribute('tabindex', '-1');
    }
    elemento.focus();
  }

  /* ---------- Creación segura de elementos (nunca se usa innerHTML con datos del usuario) ---------- */
  function h(etiqueta, props) {
    var el = document.createElement(etiqueta);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'clase') el.className = v;
        else if (k === 'texto') el.textContent = v;
        else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var hijos = [].concat(arguments[i]);
      hijos.forEach(function (hijo) {
        if (hijo === null || hijo === undefined || hijo === false) return;
        el.append(hijo.nodeType ? hijo : document.createTextNode(String(hijo)));
      });
    }
    return el;
  }

  /* ---------- Errores de formulario (3.3.1 y 3.3.3) ---------- */
  // Convención del HTML: cada campo tiene <p class="error" data-error-for="nombre" hidden>.
  function limpiarErrores(form, resumen) {
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    form.querySelectorAll('[data-error-for]').forEach(function (p) { p.hidden = true; p.textContent = ''; });
    if (resumen) { resumen.hidden = true; resumen.replaceChildren(); }
  }

  function mostrarErrores(form, campos, resumen, general) {
    limpiarErrores(form, resumen);
    var nombres = Object.keys(campos || {});
    var lista = h('ul');
    nombres.forEach(function (n) {
      var mensaje = campos[n];
      var p = form.querySelector('[data-error-for="' + n + '"]');
      if (p) { p.textContent = mensaje; p.hidden = false; }
      var destino = form.querySelector('[data-foco-para="' + n + '"]');
      if (!destino) { var c = form.elements[n]; destino = c && c.tagName ? c : c && c[0]; }
      if (destino && /^(INPUT|SELECT|TEXTAREA)$/.test(destino.tagName) && destino.type !== 'radio') {
        destino.setAttribute('aria-invalid', 'true');
      }
      lista.append(h('li', null, h('a', { href: '#', onclick: function (e) { e.preventDefault(); enfocar(destino); } }, mensaje)));
    });
    var titulo = nombres.length === 0 ? 'No se pudo completar la acción'
      : nombres.length === 1 ? 'Hay 1 dato por corregir' : 'Hay ' + nombres.length + ' datos por corregir';
    // replaceChildren convertiría un null en el texto "null": se filtran los vacíos.
    resumen.replaceChildren.apply(resumen, [
      h('h2', { texto: titulo }),
      general ? h('p', { texto: general }) : null,
      nombres.length ? lista : null
    ].filter(Boolean));
    resumen.hidden = false;
    enfocar(resumen);
  }

  // Al escribir o elegir en un campo, se quita su error.
  function vigilar(form) {
    function limpiarCampo(e) {
      var n = e.target.name;
      if (!n) return;
      var p = form.querySelector('[data-error-for="' + n + '"]');
      if (p) { p.hidden = true; p.textContent = ''; }
      e.target.removeAttribute('aria-invalid');
      // Cuando ya no queda ningún error visible, el resumen también se oculta.
      var resumen = form.querySelector('.resumen-errores');
      if (resumen && !resumen.hidden && !form.querySelector('[data-error-for]:not([hidden])')) {
        resumen.hidden = true;
        resumen.replaceChildren();
      }
    }
    form.addEventListener('input', limpiarCampo);
    form.addEventListener('change', limpiarCampo);
  }

  document.addEventListener('DOMContentLoaded', function () {
    crearRegion();
    aplicarPreferencias();
    alternar('btn-texto', 'cs-texto', 'grande', 'normal', 'texto', 'Texto grande activado.', 'Texto normal.');
    alternar('btn-contraste', 'cs-contraste', 'alto', 'normal', 'contraste', 'Alto contraste activado.', 'Contraste normal.');
  });
  aplicarPreferencias(); // evita el parpadeo: se aplica ya al cargar el script

  window.A11y = { anunciar: anunciar, enfocar: enfocar, h: h, mostrarErrores: mostrarErrores, limpiarErrores: limpiarErrores, vigilar: vigilar };
})();
