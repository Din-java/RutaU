'use strict';
const crypto = require('crypto');
const db = require('../db');

// Sesiones en memoria: se pierden al reiniciar el servidor (el usuario vuelve a iniciar sesión).
const sesiones = new Map(); // id de sesión -> { usuarioId, expira }
const DURACION_SESION = 2 * 60 * 60 * 1000; // 2 horas, se renueva con cada uso

// Límite de intentos fallidos de inicio de sesión (fuerza bruta).
const intentos = new Map(); // clave -> { n, hasta }
const MAX_INTENTOS = 5;
const ESPERA = 60 * 1000;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function fallo(estado, mensaje, campos) {
  const error = new Error(mensaje);
  error.estado = estado;
  if (campos) error.campos = campos;
  return error;
}

function hashear(clave, sal) {
  return crypto.scryptSync(clave, sal, 64);
}

function publico(u) {
  return { id: u.id, nombre: u.nombre, correo: u.correo };
}

function leerCookie(req, nombre) {
  const cabecera = req.headers.cookie;
  if (!cabecera) return null;
  for (const par of cabecera.split(';')) {
    const i = par.indexOf('=');
    if (i > 0 && par.slice(0, i).trim() === nombre) return par.slice(i + 1).trim();
  }
  return null;
}

function cookieSesion(req, valor, maxAge) {
  const seguro = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  // HttpOnly: JavaScript no puede leerla. SameSite=Strict: no viaja desde otros sitios.
  return `sid=${valor}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${seguro}`;
}

function iniciarSesion(req, usuario, estado) {
  const sid = crypto.randomBytes(32).toString('hex');
  sesiones.set(sid, { usuarioId: usuario.id, expira: Date.now() + DURACION_SESION });
  return {
    estado,
    datos: { usuario: publico(usuario) },
    cabeceras: { 'Set-Cookie': cookieSesion(req, sid, DURACION_SESION / 1000) },
  };
}

/** Devuelve el usuario de la sesión actual o null. Lo usa el enrutador. */
function autenticar(req) {
  const sid = leerCookie(req, 'sid');
  const sesion = sid && sesiones.get(sid);
  if (!sesion) return null;
  if (sesion.expira < Date.now()) {
    sesiones.delete(sid);
    return null;
  }
  const usuario = db.leer('usuarios').find((u) => u.id === sesion.usuarioId);
  if (!usuario) return null;
  sesion.expira = Date.now() + DURACION_SESION;
  return publico(usuario);
}

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function registro({ req, body }) {
  const nombre = texto(body.nombre).replace(/\s+/g, ' ');
  const correo = texto(body.correo).toLowerCase();
  const clave = typeof body.clave === 'string' ? body.clave : '';
  const campos = {};

  if (nombre.length < 2 || nombre.length > 80) campos.nombre = 'Escribe tu nombre completo (entre 2 y 80 caracteres).';
  if (!CORREO.test(correo) || correo.length > 120) campos.correo = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
  if (clave.length < 8 || clave.length > 72 || !/[A-Za-z]/.test(clave) || !/\d/.test(clave)) {
    campos.clave = 'La contraseña debe tener entre 8 y 72 caracteres, con al menos una letra y un número.';
  }
  if (Object.keys(campos).length) throw fallo(400, 'Revisa los datos del formulario.', campos);

  const usuarios = db.leer('usuarios');
  if (usuarios.some((u) => u.correo === correo)) {
    throw fallo(409, 'Ya existe una cuenta con ese correo.', {
      correo: 'Ya existe una cuenta con este correo. Inicia sesión o usa otro correo.',
    });
  }

  const sal = crypto.randomBytes(16);
  const usuario = {
    id: crypto.randomUUID(),
    nombre,
    correo,
    sal: sal.toString('hex'),
    hash: hashear(clave, sal).toString('hex'),
    creado: new Date().toISOString(),
  };
  usuarios.push(usuario);
  db.guardar('usuarios', usuarios);
  return iniciarSesion(req, usuario, 201);
}

function login({ req, body }) {
  const correo = texto(body.correo).toLowerCase();
  const clave = typeof body.clave === 'string' ? body.clave : '';
  const campos = {};
  if (!correo) campos.correo = 'Escribe tu correo.';
  if (!clave) campos.clave = 'Escribe tu contraseña.';
  if (Object.keys(campos).length) throw fallo(400, 'Revisa los datos del formulario.', campos);

  const llave = correo + '|' + req.socket.remoteAddress;
  const registro = intentos.get(llave);
  if (registro && registro.n >= MAX_INTENTOS && registro.hasta > Date.now()) {
    throw fallo(429, 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.');
  }

  const usuario = db.leer('usuarios').find((u) => u.correo === correo);
  // Se calcula el hash aunque el usuario no exista, para que el tiempo de respuesta no delate si el correo está registrado.
  const sal = usuario ? Buffer.from(usuario.sal, 'hex') : Buffer.alloc(16);
  const calculado = hashear(clave, sal);
  const correcto = usuario && crypto.timingSafeEqual(calculado, Buffer.from(usuario.hash, 'hex'));

  if (!correcto) {
    const actual = intentos.get(llave) || { n: 0, hasta: 0 };
    if (actual.hasta < Date.now()) actual.n = 0;
    actual.n += 1;
    actual.hasta = Date.now() + ESPERA;
    intentos.set(llave, actual);
    throw fallo(401, 'Correo o contraseña incorrectos.');
  }
  intentos.delete(llave);
  return iniciarSesion(req, usuario, 200);
}

function logout({ req }) {
  const sid = leerCookie(req, 'sid');
  if (sid) sesiones.delete(sid);
  return { estado: 200, datos: { ok: true }, cabeceras: { 'Set-Cookie': cookieSesion(req, '', 0) } };
}

function perfil({ usuario }) {
  return { datos: { usuario } };
}

module.exports = { registro, login, logout, perfil, autenticar };
