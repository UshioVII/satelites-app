const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { openDb } = require('./db');
const routesAuth = require('./routes.auth');
const routesFavorites = require('./routes.favorites');
const routesNotes = require('./routes.notes');
const routesAvatar = require('./routes.avatar');

function createApp(db) {
  const app = express();
  app.set('trust proxy', 1); // detrás de Caddy/proxy: req.ip usa X-Forwarded-For (para el rate limit)
  // CORS restringido al frontend (coma-separado en CORS_ORIGIN para varios). En dev el proxy de Angular
  // es same-origin, así que esto solo cierra el API a orígenes ajenos.
  app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : 'http://localhost:4200' }));
  app.use(express.json());
  app.use('/api', routesAuth(db));
  app.use('/api/favorites', routesFavorites(db));
  app.use('/api/notes', routesNotes(db));
  app.use('/api/avatar', routesAvatar(db));
  app.use('/media', express.static(path.join(__dirname, 'media'), {
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'), // no dejar que el browser adivine el tipo
  }));
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'error interno' });
  });
  return app;
}

if (require.main === module) {
  const db = openDb();
  const port = process.env.PORT || 3000;
  createApp(db).listen(port, () => console.log(`API en http://localhost:${port}`));
}

module.exports = { createApp };
