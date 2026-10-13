'use strict';
/**
 * Servidor HTTP nativo (módulo `http` de Node, sin dependencias).
 * - Rutas /api/*  -> router.js
 * - Todo lo demás -> archivos estáticos de ../frontend
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const router = require('./router');

const PORT = Number(process.env.PORT) || 3000;
// En local escucha solo en 127.0.0.1; en un hosting (que define PORT) escucha en todas las interfaces.
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const FRONTEND = path.resolve(__dirname, '..', 'frontend');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const CABECERAS_SEGURIDAD = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'self'",
};

function responder(res, estado, texto) {
  res.writeHead(estado, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(texto);
}

function servirEstatico(req, res) {
  let ruta;
  try {
    ruta = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return responder(res, 400, 'Solicitud no válida.');
  }
  if (ruta === '/') ruta = '/index.html';

  const archivo = path.normalize(path.join(FRONTEND, ruta));
  // Evita salir de la carpeta frontend con rutas como /../backend/data/usuarios.json
  if (archivo !== FRONTEND && !archivo.startsWith(FRONTEND + path.sep)) {
    return responder(res, 403, 'Acceso denegado.');
  }

  fs.stat(archivo, (err, info) => {
    if (err || !info.isFile()) return responder(res, 404, 'Página no encontrada.');
    const tipo = TIPOS[path.extname(archivo).toLowerCase()];
    if (!tipo) return responder(res, 404, 'Página no encontrada.');
    res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': info.size, 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(archivo).pipe(res);
  });
}

const servidor = http.createServer((req, res) => {
  for (const [nombre, valor] of Object.entries(CABECERAS_SEGURIDAD)) res.setHeader(nombre, valor);
  try {
    if (req.url.startsWith('/api/')) return router.manejar(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return servirEstatico(req, res);
    return responder(res, 405, 'Método no permitido.');
  } catch (err) {
    console.error(err);
    if (!res.headersSent) responder(res, 500, 'Error interno del servidor.');
  }
});

servidor.listen(PORT, HOST, () => {
  console.log(`RutaU en http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
