/* Sesión: protege las páginas internas y maneja el formulario de acceso (index.html). */
(function () {
  'use strict';

  /** Devuelve el usuario con sesión activa o redirige al inicio de sesión. */
  async function exigirSesion() {
    try {
      var r = await Api.perfil();
      return r.usuario;
    } catch (e) {
      if (e.red) {
        A11y.anunciar(e.message);
        throw e;
      }
      location.replace('index.html');
      return null;
    }
  }

  function activarSalir() {
    document.querySelectorAll('[data-salir]').forEach(function (boton) {
      boton.addEventListener('click', async function () {
        try { await Api.logout(); } catch (e) { /* aunque falle, se sale de la página */ }
        location.replace('index.html');
      });
    });
  }

  window.Auth = { exigirSesion: exigirSesion, activarSalir: activarSalir };

  /* ---------- Solo en index.html ---------- */
  var formLogin = document.getElementById('form-login');
  var formRegistro = document.getElementById('form-registro');
  if (!formLogin || !formRegistro) return;

  var resumenLogin = document.getElementById('resumen-login');
  var resumenRegistro = document.getElementById('resumen-registro');
  var CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (new URLSearchParams(location.search).get('sesion') === 'expirada') {
    var aviso = document.getElementById('aviso-sesion');
    aviso.textContent = 'Tu sesión terminó. Inicia sesión de nuevo para continuar.';
    aviso.hidden = false;
  }

  // Si ya hay una sesión activa, ir directo al panel.
  Api.perfil().then(function () { location.replace('dashboard.html'); }).catch(function () { /* sin sesión: se queda aquí */ });

  A11y.vigilar(formLogin);
  A11y.vigilar(formRegistro);

  function bloquear(boton, ocupado, textoOcupado, textoNormal) {
    boton.disabled = ocupado;
    boton.textContent = ocupado ? textoOcupado : textoNormal;
  }

  formLogin.addEventListener('submit', async function (e) {
    e.preventDefault();
    var datos = { correo: formLogin.correo.value.trim(), clave: formLogin.clave.value };
    var errores = {};
    if (!datos.correo) errores.correo = 'Escribe tu correo.';
    else if (!CORREO.test(datos.correo)) errores.correo = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    if (!datos.clave) errores.clave = 'Escribe tu contraseña.';
    if (Object.keys(errores).length) return A11y.mostrarErrores(formLogin, errores, resumenLogin);

    A11y.limpiarErrores(formLogin, resumenLogin);
    var boton = formLogin.querySelector('button[type="submit"]');
    bloquear(boton, true, 'Entrando…', 'Iniciar sesión');
    try {
      await Api.login(datos);
      location.replace('dashboard.html');
    } catch (err) {
      bloquear(boton, false, '', 'Iniciar sesión');
      A11y.mostrarErrores(formLogin, err.campos || {}, resumenLogin, err.campos ? null : err.message);
    }
  });

  formRegistro.addEventListener('submit', async function (e) {
    e.preventDefault();
    var datos = {
      nombre: formRegistro.nombre.value.trim(),
      correo: formRegistro.correo.value.trim(),
      clave: formRegistro.clave.value,
    };
    var confirmar = formRegistro.clave2.value;
    var errores = {};
    if (datos.nombre.length < 2) errores.nombre = 'Escribe tu nombre completo.';
    if (!CORREO.test(datos.correo)) errores.correo = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    if (datos.clave.length < 8 || !/[A-Za-z]/.test(datos.clave) || !/\d/.test(datos.clave)) {
      errores.clave = 'La contraseña debe tener al menos 8 caracteres, con una letra y un número.';
    }
    if (confirmar !== datos.clave) errores.clave2 = 'Las contraseñas no coinciden. Vuelve a escribirla.';
    if (Object.keys(errores).length) return A11y.mostrarErrores(formRegistro, errores, resumenRegistro);

    A11y.limpiarErrores(formRegistro, resumenRegistro);
    var boton = formRegistro.querySelector('button[type="submit"]');
    bloquear(boton, true, 'Creando cuenta…', 'Crear cuenta');
    try {
      await Api.registro(datos);
      location.replace('dashboard.html');
    } catch (err) {
      bloquear(boton, false, '', 'Crear cuenta');
      A11y.mostrarErrores(formRegistro, err.campos || {}, resumenRegistro, err.campos ? null : err.message);
    }
  });

  // Mostrar u ocultar las contraseñas del registro.
  document.getElementById('ver-claves').addEventListener('change', function (e) {
    var tipo = e.target.checked ? 'text' : 'password';
    formRegistro.clave.type = tipo;
    formRegistro.clave2.type = tipo;
  });
})();
