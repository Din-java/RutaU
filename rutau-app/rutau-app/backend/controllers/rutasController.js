'use strict';
/**
 * Consulta de rutas y paradas, próximas salidas y paradas favoritas.
 * Los horarios son SIMULADOS: cada ruta sale cada `frecuencia` minutos y tarda
 * MIN_ENTRE_PARADAS minutos entre una parada y la siguiente.
 */
const db = require('../db');

const MIN_ENTRE_PARADAS = 3;

function fallo(estado, mensaje) {
  const error = new Error(mensaje);
  error.estado = estado;
  return error;
}

const mod = (a, n) => ((a % n) + n) % n;
const minutoActual = () => Math.floor(Date.now() / 60000);

/** Minutos que faltan para que el autobús de la ruta llegue a la parada en la posición `indice`. */
function espera(ruta, indice) {
  return mod(ruta.desfase + indice * MIN_ENTRE_PARADAS - minutoActual(), ruta.frecuencia);
}

function catalogo() {
  const paradas = db.leer('paradas');
  return { paradas, rutas: db.leer('rutas'), porId: new Map(paradas.map((p) => [p.id, p])) };
}

function favoritasDe(usuarioId) {
  return db.leer('favoritas').filter((f) => f.usuarioId === usuarioId).map((f) => f.paradaId);
}

function salidasDe(paradaId, rutas, porId) {
  return rutas
    .map((r) => ({ r, i: r.paradas.indexOf(paradaId) }))
    .filter((x) => x.i >= 0)
    .map((x) => ({
      rutaId: x.r.id,
      codigo: x.r.codigo,
      ruta: x.r.nombre,
      destino: porId.get(x.r.paradas[x.r.paradas.length - 1]).nombre,
      minutos: espera(x.r, x.i),
    }))
    .sort((a, b) => a.minutos - b.minutos);
}

function listaParadas() {
  const { paradas } = catalogo();
  const ordenadas = [...paradas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return { datos: { paradas: ordenadas } };
}

function salidas({ params, usuario }) {
  const { rutas, porId } = catalogo();
  const parada = porId.get(params.id);
  if (!parada) throw fallo(404, 'No encontramos esa parada.');
  return {
    datos: {
      parada,
      favorita: favoritasDe(usuario.id).includes(parada.id),
      salidas: salidasDe(parada.id, rutas, porId),
    },
  };
}

function listaRutas() {
  const { rutas, porId } = catalogo();
  return {
    datos: {
      rutas: rutas.map((r) => ({
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        frecuencia: r.frecuencia,
        totalParadas: r.paradas.length,
        destino: porId.get(r.paradas[r.paradas.length - 1]).nombre,
      })),
    },
  };
}

function detalleRuta({ params, usuario }) {
  const { rutas, porId } = catalogo();
  const ruta = rutas.find((r) => r.id === params.id);
  if (!ruta) throw fallo(404, 'No encontramos esa ruta.');

  const favoritas = favoritasDe(usuario.id);
  const desdeSalida = mod(minutoActual() - ruta.desfase, ruta.frecuencia);
  const posicion = Math.min(ruta.paradas.length - 1, Math.floor(desdeSalida / MIN_ENTRE_PARADAS));

  return {
    datos: {
      ruta: { id: ruta.id, codigo: ruta.codigo, nombre: ruta.nombre, frecuencia: ruta.frecuencia },
      autobus: { paradaActual: porId.get(ruta.paradas[posicion]).nombre, proximaSalida: espera(ruta, 0) },
      paradas: ruta.paradas.map((id, i) => ({
        id,
        nombre: porId.get(id).nombre,
        minutos: espera(ruta, i),
        pasada: i < posicion,
        aqui: i === posicion,
        favorita: favoritas.includes(id),
      })),
    },
  };
}

/* ---------- Favoritas ---------- */
function listaFavoritas({ usuario }) {
  const { rutas, porId } = catalogo();
  const favoritas = favoritasDe(usuario.id)
    .map((id) => porId.get(id))
    .filter(Boolean)
    .map((p) => ({ id: p.id, nombre: p.nombre, siguiente: salidasDe(p.id, rutas, porId)[0] || null }));
  return { datos: { favoritas } };
}

function agregarFavorita({ params, usuario }) {
  const { porId } = catalogo();
  if (!porId.has(params.id)) throw fallo(404, 'No encontramos esa parada.');
  const todas = db.leer('favoritas');
  if (!todas.some((f) => f.usuarioId === usuario.id && f.paradaId === params.id)) {
    todas.push({ usuarioId: usuario.id, paradaId: params.id, creada: new Date().toISOString() });
    db.guardar('favoritas', todas);
  }
  return { datos: { favorita: true } };
}

function quitarFavorita({ params, usuario }) {
  const todas = db.leer('favoritas');
  const resto = todas.filter((f) => !(f.usuarioId === usuario.id && f.paradaId === params.id));
  if (resto.length !== todas.length) db.guardar('favoritas', resto);
  return { datos: { favorita: false } };
}

module.exports = {
  listaParadas, salidas, listaRutas, detalleRuta, listaFavoritas, agregarFavorita, quitarFavorita,
};
