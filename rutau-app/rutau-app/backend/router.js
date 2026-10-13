'use strict';
/**
 * Enrutador mínimo: asocia método + ruta con un controlador.
 * Los controladores reciben un contexto { req, params, query, body, usuario }
 * y devuelven { estado?, datos?, cabeceras? }, o lanzan un error con .estado.
 */
const { URL } = require('url');
const usuarios = require('./controllers/usuariosController');
const rutasCtl = require('./controllers/rutasController');
const reportes = require('./controllers/reportesController');

const LIMITE_CUERPO = 50 * 1024; // 50 KB
const rutas = [];

function agregar(metodo, patron, manejador, opciones = {}) {
  const claves = [];
  const re = new RegExp(
    '^' + patron.replace(/:(\w+)/g, (_, clave) => { claves.push(clave); return '([^/]+)'; }) + '$'
  );
  rutas.push({ metodo, re, claves, manejador, auth: Boolean(opciones.auth) });
}

// ---- Tabla de rutas de la API ----
agregar('POST', '/api/registro', usuarios.registro);
agregar('POST', '/api/login', usuarios.login);
agregar('POST', '/api/logout', usuarios.logout);
agregar('GET', '/api/perfil', usuarios.perfil, { auth: true });
agregar('GET', '/api/paradas', rutasCtl.listaParadas, { auth: true });
agregar('GET', '/api/paradas/:id/salidas', rutasCtl.salidas, { auth: true });
agregar('GET', '/api/rutas', rutasCtl.listaRutas, { auth: true });
agregar('GET', '/api/rutas/:id', rutasCtl.detalleRuta, { auth: true });
agregar('GET', '/api/favoritas', rutasCtl.listaFavoritas, { auth: true });
agregar('PUT', '/api/favoritas/:id', rutasCtl.agregarFavorita, { auth: true });
agregar('DELETE', '/api/favoritas/:id', rutasCtl.quitarFavorita, { auth: true });
agregar('GET', '/api/reportes', reportes.listar, { auth: true });
agregar('POST', '/api/reportes', reportes.crear, { auth: true });
agregar('DELETE', '/api/reportes/:id', reportes.retirar, { auth: true });

function enviar(res, estado, datos, cabeceras = {}) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(cuerpo),
    'Cache-Control': 'no-store',
    ...cabeceras,
  });
  res.end(cuerpo);
}

function error(estado, mensaje) {
  const e = new Error(mensaje);
  e.estado = estado;
  return e;
}

function leerCuerpo(req) {
  return new Promise((resolver, rechazar) => {
    const trozos = [];
    let tamano = 0;
    let excedido = false;
    req.on('data', (trozo) => {
      tamano += trozo.length;
      if (tamano > LIMITE_CUERPO) { excedido = true; trozos.length = 0; return; }
      if (!excedido) trozos.push(trozo);
    });
    req.on('error', rechazar);
    req.on('end', () => {
      if (excedido) return rechazar(error(413, 'La solicitud es demasiado grande.'));
      if (!trozos.length) return resolver({});
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
        return rechazar(error(415, 'El contenido debe enviarse como JSON.'));
      }
      try {
        const objeto = JSON.parse(Buffer.concat(trozos).toString('utf8'));
        if (objeto === null || typeof objeto !== 'object' || Array.isArray(objeto)) throw new Error();
        resolver(objeto);
      } catch {
        rechazar(error(400, 'El cuerpo de la solicitud no es un JSON válido.'));
      }
    });
  });
}

async function manejar(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const candidatas = rutas.filter((r) => r.re.test(url.pathname));
    if (!candidatas.length) throw error(404, 'Ruta no encontrada.');

    const ruta = candidatas.find((r) => r.metodo === req.method);
    if (!ruta) {
      res.setHeader('Allow', candidatas.map((r) => r.metodo).join(', '));
      throw error(405, 'Método no permitido.');
    }

    const coincidencia = ruta.re.exec(url.pathname);
    const params = {};
    ruta.claves.forEach((clave, i) => { params[clave] = decodeURIComponent(coincidencia[i + 1]); });

    const ctx = { req, params, query: Object.fromEntries(url.searchParams), body: {}, usuario: null };
    if (ruta.auth) {
      ctx.usuario = usuarios.autenticar(req);
      if (!ctx.usuario) throw error(401, 'Debes iniciar sesión para continuar.');
    }
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      ctx.body = await leerCuerpo(req);
    }

    const resultado = (await ruta.manejador(ctx)) || {};
    enviar(res, resultado.estado || 200, resultado.datos || {}, resultado.cabeceras);
  } catch (err) {
    const estado = err instanceof URIError ? 400 : err.estado || 500;
    if (estado === 500) console.error(err);
    const cuerpo = { error: estado === 500 ? 'Error interno del servidor.' : err.message };
    if (err.campos) cuerpo.campos = err.campos;
    if (!res.headersSent) enviar(res, estado, cuerpo);
  }
}

module.exports = { manejar };
