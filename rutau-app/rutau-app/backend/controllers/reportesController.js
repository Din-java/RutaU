'use strict';
const crypto = require('crypto');
const db = require('../db');

const TIPOS = ['Retraso', 'Autobús lleno', 'Parada dañada', 'Otro'];

function fallo(estado, mensaje, campos) {
  const error = new Error(mensaje);
  error.estado = estado;
  if (campos) error.campos = campos;
  return error;
}

function presentar(reporte) {
  const ruta = db.leer('rutas').find((r) => r.id === reporte.rutaId);
  return {
    id: reporte.id,
    folio: reporte.folio,
    tipo: reporte.tipo,
    rutaId: reporte.rutaId,
    ruta: ruta ? ruta.nombre : 'Ruta no disponible',
    descripcion: reporte.descripcion,
    estado: reporte.estado,
    creado: reporte.creado,
  };
}

function folioNuevo(reportes) {
  let folio;
  do { folio = 'RU-' + crypto.randomInt(100000, 1000000); } while (reportes.some((r) => r.folio === folio));
  return folio;
}

function crear({ usuario, body }) {
  const tipo = typeof body.tipo === 'string' ? body.tipo : '';
  const rutaId = typeof body.ruta === 'string' ? body.ruta : '';
  const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim().replace(/\s+/g, ' ') : '';
  const campos = {};

  if (!TIPOS.includes(tipo)) campos.tipo = 'Elige qué tipo de problema ocurrió.';
  if (!db.leer('rutas').some((r) => r.id === rutaId)) campos.ruta = 'Elige la ruta donde ocurrió.';
  if (descripcion.length < 15 || descripcion.length > 300) {
    campos.descripcion = 'Describe el problema con al menos 15 caracteres (máximo 300).';
  }
  if (Object.keys(campos).length) throw fallo(400, 'Revisa los datos del reporte.', campos);

  const reportes = db.leer('reportes');
  const reporte = {
    id: crypto.randomUUID(),
    folio: folioNuevo(reportes),
    usuarioId: usuario.id,
    tipo,
    rutaId,
    descripcion,
    estado: 'recibido',
    creado: new Date().toISOString(),
  };
  reportes.push(reporte);
  db.guardar('reportes', reportes);
  return { estado: 201, datos: { reporte: presentar(reporte) } };
}

function listar({ usuario }) {
  const propios = db.leer('reportes')
    .filter((r) => r.usuarioId === usuario.id)
    .sort((a, b) => b.creado.localeCompare(a.creado));
  return { datos: { reportes: propios.map(presentar) } };
}

function retirar({ usuario, params }) {
  const reportes = db.leer('reportes');
  // Se filtra por dueño: no se revela si un reporte ajeno existe.
  const reporte = reportes.find((r) => r.id === params.id && r.usuarioId === usuario.id);
  if (!reporte) throw fallo(404, 'No encontramos ese reporte.');
  if (reporte.estado !== 'retirado') {
    reporte.estado = 'retirado';
    reporte.retirado = new Date().toISOString();
    db.guardar('reportes', reportes);
  }
  return { datos: { reporte: presentar(reporte) } };
}

module.exports = { crear, listar, retirar };
