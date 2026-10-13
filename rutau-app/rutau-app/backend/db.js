'use strict';
/**
 * Persistencia en archivos JSON.
 * Cada "colección" es un arreglo guardado en backend/data/<nombre>.json.
 * Las operaciones son síncronas: Node ejecuta un solo hilo, así que no hay
 * condiciones de carrera entre lecturas y escrituras.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'data');
// Colecciones que la app escribe (se crean vacías si no existen)...
const ESCRIBIBLES = new Set(['usuarios', 'favoritas', 'reportes']);
// ...y catálogos de solo lectura que vienen con el proyecto (rutas y paradas).
const CATALOGOS = new Set(['paradas', 'rutas']);

function archivo(nombre) {
  // Lista blanca: evita que un nombre externo escape de la carpeta data/.
  if (!ESCRIBIBLES.has(nombre) && !CATALOGOS.has(nombre)) throw new Error('Colección desconocida: ' + nombre);
  return path.join(DIR, nombre + '.json');
}

function iniciar() {
  fs.mkdirSync(DIR, { recursive: true });
  for (const nombre of ESCRIBIBLES) {
    const ruta = archivo(nombre);
    if (!fs.existsSync(ruta)) fs.writeFileSync(ruta, '[]\n');
  }
}

function leer(nombre) {
  const datos = JSON.parse(fs.readFileSync(archivo(nombre), 'utf8'));
  return Array.isArray(datos) ? datos : [];
}

function guardar(nombre, datos) {
  if (CATALOGOS.has(nombre)) throw new Error('El catálogo es de solo lectura: ' + nombre);
  const ruta = archivo(nombre);
  const temporal = ruta + '.tmp';
  // Se escribe a un temporal y se renombra: si el proceso se corta a la mitad,
  // el archivo original no queda truncado.
  fs.writeFileSync(temporal, JSON.stringify(datos, null, 2) + '\n');
  fs.renameSync(temporal, ruta);
}

iniciar();

module.exports = { leer, guardar };
