/* Cliente HTTP: toda la comunicación con el backend pasa por aquí. */
(function () {
  'use strict';

  var enLogin = /(^\/$|index\.html$)/.test(location.pathname);

  async function solicitar(metodo, ruta, cuerpo) {
    var opciones = { method: metodo, headers: { Accept: 'application/json' }, credentials: 'same-origin' };
    if (cuerpo !== undefined) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }

    var respuesta;
    try {
      respuesta = await fetch('/api' + ruta, opciones);
    } catch (e) {
      var sinRed = new Error('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
      sinRed.red = true;
      throw sinRed;
    }

    var datos = null;
    try { datos = await respuesta.json(); } catch (e) { /* respuesta sin cuerpo */ }

    if (!respuesta.ok) {
      // Sesión vencida en cualquier página protegida: volver al inicio de sesión.
      if (respuesta.status === 401 && !enLogin) {
        location.replace('index.html?sesion=expirada');
      }
      var error = new Error((datos && datos.error) || 'Ocurrió un error inesperado. Inténtalo de nuevo.');
      error.estado = respuesta.status;
      error.campos = datos && datos.campos;
      throw error;
    }
    return datos;
  }

  /* ---------- Formato ---------- */
  function fechaHora(iso) {
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
  }
  function minutos(m) {
    return m === 0 ? 'Ahora' : m + ' min';
  }

  window.Api = {
    registro: function (datos) { return solicitar('POST', '/registro', datos); },
    login: function (datos) { return solicitar('POST', '/login', datos); },
    logout: function () { return solicitar('POST', '/logout'); },
    perfil: function () { return solicitar('GET', '/perfil'); },
    paradas: function () { return solicitar('GET', '/paradas'); },
    salidas: function (parada) { return solicitar('GET', '/paradas/' + encodeURIComponent(parada) + '/salidas'); },
    rutas: function () { return solicitar('GET', '/rutas'); },
    ruta: function (id) { return solicitar('GET', '/rutas/' + encodeURIComponent(id)); },
    favoritas: function () { return solicitar('GET', '/favoritas'); },
    guardarFavorita: function (parada) { return solicitar('PUT', '/favoritas/' + encodeURIComponent(parada)); },
    quitarFavorita: function (parada) { return solicitar('DELETE', '/favoritas/' + encodeURIComponent(parada)); },
    reportes: function () { return solicitar('GET', '/reportes'); },
    crearReporte: function (datos) { return solicitar('POST', '/reportes', datos); },
    retirarReporte: function (id) { return solicitar('DELETE', '/reportes/' + encodeURIComponent(id)); },
    fechaHora: fechaHora,
    minutos: minutos,
  };
})();
