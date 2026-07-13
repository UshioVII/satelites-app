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
  app.use(cors());
  app.use(express.json());
  app.use('/api', routesAuth(db));
  app.use('/api/favorites', routesFavorites(db));
  app.use('/api/notes', routesNotes(db));
  app.use('/api/avatar', routesAvatar(db));
  app.use('/media', express.static(path.join(__dirname, 'media')));
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
