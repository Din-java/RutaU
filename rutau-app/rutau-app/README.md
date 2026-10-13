# RutaU – Transporte universitario

Práctica 3.3 de Interacción Humano-Computadora (Diseño, Usabilidad y Accesibilidad).
Dominio elegido: **app de transporte universitario**.

Aplicación web con **backend en Node.js nativo** (módulo `http`, sin dependencias) y **frontend en HTML5, CSS3 y JavaScript** sin frameworks. Los datos se guardan en archivos JSON. Los horarios de los autobuses son **simulados**.

## Cómo ejecutarlo

Requisitos: Node.js 18 o superior.

```bash
node backend/server.js
# o: npm start
```

Abre **http://localhost:3000**. No hay nada que instalar.

> El frontend necesita el servidor: no funciona abriendo los `.html` con doble clic, porque las páginas llaman a la API en `/api`.

## Estructura

```
rutau-app/
├── backend/
│   ├── server.js                  # Servidor HTTP nativo + archivos estáticos + cabeceras de seguridad
│   ├── router.js                  # Enrutador (tabla de rutas, lectura de JSON, manejo de errores)
│   ├── db.js                      # Persistencia en JSON (escritura atómica)
│   ├── data/
│   │   ├── paradas.json           # Catálogo de paradas (solo lectura)
│   │   ├── rutas.json             # Catálogo de rutas (solo lectura)
│   │   ├── usuarios.json          # Cuentas (ignorado por git: contiene hashes)
│   │   ├── favoritas.json         # Paradas favoritas por usuario
│   │   └── reportes.json          # Reportes de problemas
│   └── controllers/
│       ├── usuariosController.js  # Registro, login, logout, sesión
│       ├── rutasController.js     # Paradas, rutas, próximas salidas y favoritas
│       └── reportesController.js  # Crear, listar y retirar reportes
├── frontend/
│   ├── index.html                 # Inicio de sesión / registro
│   ├── dashboard.html             # Panel: próximas salidas de mi parada y favoritas
│   ├── rutas.html                 # Lista de rutas y detalle con paradas
│   ├── reportar.html              # Reportar un problema
│   ├── mis-reportes.html          # Lista y retiro de reportes
│   ├── css/
│   │   ├── styles.css             # Diseño y componentes
│   │   └── accessibility.css      # Foco, saltar al contenido, texto grande, alto contraste
│   └── js/
│       ├── api.js                 # Cliente HTTP
│       ├── auth.js                # Sesión, login y registro
│       ├── dashboard.js           # Panel
│       ├── rutas.js               # Rutas y detalle
│       ├── reportar.js            # Reportar
│       ├── mis-reportes.js        # Mis reportes
│       └── a11y.js                # Utilidades de accesibilidad
├── package.json
└── README.md
```

## API

| Método | Ruta | Descripción | Sesión |
|---|---|---|---|
| POST | `/api/registro` | Crea cuenta e inicia sesión | No |
| POST | `/api/login` | Inicia sesión | No |
| POST | `/api/logout` | Cierra sesión | No |
| GET | `/api/perfil` | Usuario actual | Sí |
| GET | `/api/paradas` | Lista de paradas | Sí |
| GET | `/api/paradas/:id/salidas` | Próximas salidas en una parada | Sí |
| GET | `/api/rutas` | Lista de rutas | Sí |
| GET | `/api/rutas/:id` | Detalle: paradas, posición del autobús, favoritas | Sí |
| GET | `/api/favoritas` | Paradas favoritas del usuario | Sí |
| PUT | `/api/favoritas/:id` | Guarda una parada como favorita | Sí |
| DELETE | `/api/favoritas/:id` | Quita una parada de favoritas | Sí |
| GET | `/api/reportes` | Reportes del usuario | Sí |
| POST | `/api/reportes` | Crea un reporte (devuelve un folio `RU-######`) | Sí |
| DELETE | `/api/reportes/:id` | Retira un reporte | Sí |

## Tareas críticas del diseño

1. **T1** – Ver en cuántos minutos pasa el próximo autobús en mi parada (Panel).
2. **T2** – Guardar y quitar una parada favorita, con «Deshacer» (Panel y detalle de ruta).
3. **T3** – Reportar un problema y recibir un folio (Reportar).

## Seguridad

- Contraseñas con `scrypt` y sal aleatoria; comparación en tiempo constante.
- Sesión en cookie `HttpOnly` + `SameSite=Strict` (JavaScript no puede leerla).
- Bloqueo de 1 minuto tras 5 intentos fallidos de inicio de sesión.
- Cada usuario solo ve sus favoritas y sus reportes.
- El servidor de archivos impide salir de `frontend/` (no se puede pedir `backend/data/*.json`).
- Cabeceras: `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`.
- El frontend nunca inserta texto del usuario con `innerHTML` (previene XSS).

## Principios de diseño aplicados (Actividad 2.1)

| Principio | Cómo se aplica | Dónde |
|---|---|---|
| Visibilidad del estado (Nielsen 1) | «Autobús en camino: está en…», tiempos que se actualizan solos, avisos tras guardar o reportar | Panel, detalle de ruta |
| Relación con el mundo real (2) | Lenguaje cotidiano: «¿Cuándo pasa mi autobús?», «Mi parada», «Llega en 5 min» | Todas |
| Control y libertad (3) | «Deshacer» al guardar o quitar favorita; Esc y «Conservar reporte» en el diálogo | Panel, mis reportes |
| Consistencia (4) | Misma cabecera, navegación, botones y colores en todas las páginas; amarillo para lo destacado | Todas |
| Prevención de errores (5) | Diálogo de confirmación antes de retirar; contador de caracteres; opciones cerradas para el tipo de problema | mis-reportes, reportar |
| Reconocer antes que recordar (6) | Mi parada y favoritas visibles en el panel; ruta y tipo de problema como listas | Panel, reportar |
| Flexibilidad (7) | Favoritas como atajo; todo se maneja con teclado; texto grande y alto contraste a un clic | Todas |
| Diseño minimalista (8) | Una tarea principal por pantalla | Todas |
| Ayuda con errores (9) | Resumen de errores con enlaces a cada campo y mensajes que dicen cómo corregir | index, reportar |
| Ayuda y documentación (10) | Textos de ayuda bajo los campos (mínimos, formato, qué hace «Guardar») | index, reportar, rutas |
| Ley de Fitts | Objetivos táctiles de al menos 44 px | Todas |
| Ley de Hick-Hyman | Solo 4 destinos principales en la navegación | Todas |
| Norman – feedback | Confirmación con foco y aviso para lectores de pantalla tras cada acción | Panel, reportar, mis reportes |

## Accesibilidad (WCAG 2.2 nivel AA) – checklist del Anexo E

| Criterio | Cómo se cumple | Verificado |
|---|---|---|
| 1.1.1 Contenido no textual | Íconos decorativos con `aria-hidden`; sin imágenes informativas | ☑ |
| 1.3.1 Información y relaciones | Landmarks (`header`, `nav`, `main`, `footer`), `label` asociados, `fieldset/legend`, listas y `dl` | ☑ |
| 1.3.5 Propósito de la entrada | Atributos `autocomplete` en nombre, correo y contraseña | ☑ |
| 1.4.3 Contraste mínimo | Texto ≥ 6,2:1 (calculado); sobre el amarillo de la cabecera, 9,1:1 | ☑ |
| 1.4.4 Redimensionar texto | Unidades `rem`; botón «Texto grande»; sin desbordes en 320, 768 y 1024 px | ☑ |
| 1.4.11 Contraste no textual | Bordes de campos ≥ 5,6:1; foco ≥ 7:1 sobre el fondo | ☑ |
| 2.1.1 Teclado | Todo operable con Tab, Enter, Espacio, flechas y Esc | ☑ |
| 2.4.1 Saltar bloques | Enlace «Saltar al contenido» | ☑ |
| 2.4.3 Orden del foco | Orden lógico; el foco se mueve a resúmenes, confirmaciones y títulos | ☑ |
| 2.4.7 Foco visible | Contorno de 3 px en todo elemento interactivo | ☑ |
| 2.5.8 Tamaño del objetivo | Controles ≥ 44 px (casillas y opciones ≥ 24 px dentro de una etiqueta de 44 px) | ☑ |
| 3.3.1 Identificación de errores | Mensaje de texto por campo + resumen con enlaces | ☑ |
| 3.3.2 Etiquetas o instrucciones | Etiqueta visible y ayuda en cada campo | ☑ |
| 4.1.2 Nombre, función, valor | `aria-pressed`, `aria-current`, `aria-invalid`, `aria-describedby`, `role="alert"`, avisos con región en vivo | ☑ |

Además: alto contraste (botón y preferencia del sistema), `prefers-reduced-motion` y modo de colores forzados.

**Pendiente de tu parte** (la rúbrica pide evidencia): correr WAVE, axe DevTools, Lighthouse y Color Contrast Analyzer sobre la página y guardar capturas; probar con NVDA o VoiceOver; zoom al 200%; y la prueba de usabilidad con 5 usuarios reales.

## Despliegue

GitHub Pages y Netlify (modo estático) **no ejecutan Node**. Para publicar este proyecto usa un servicio que corra Node, por ejemplo Render, Railway o Fly.io, con el comando de inicio `node backend/server.js`. El servidor lee la variable `PORT` y escucha en todas las interfaces cuando está definida.

Aviso: en los planes gratuitos el disco es temporal, así que los archivos JSON (cuentas, favoritas y reportes) se reinician al volver a desplegar. Para la demo no importa.

URL desplegada: _(pendiente)_
