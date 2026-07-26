const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET es obligatorio en producción');
  // En dev, sin JWT_SECRET, persistimos un secreto en disco (server/.jwt-secret, gitignored) para que
  // las sesiones sobrevivan a los reinicios del server. Cierra el forjado con el default público.
  const fs = require('node:fs');
  const secretFile = require('node:path').join(__dirname, '.jwt-secret');
  if (fs.existsSync(secretFile)) {
    SECRET = fs.readFileSync(secretFile, 'utf8').trim();
  } else {
    SECRET = require('node:crypto').randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, SECRET, { mode: 0o600 });
    console.warn('[auth] Generé un JWT secret de dev en server/.jwt-secret (persistente entre reinicios).');
  }
}
const PUBLIC_COLS = 'id, email, display_name, home_lat, home_lng, viz_mode, avatar';

function hashPassword(pw) {
  return bcrypt.hashSync(pw, 10);
}
function verifyPassword(pw, hash) {
  return bcrypt.compareSync(pw, hash);
}
function signToken(user) {
  return jwt.sign({ uid: user.id }, SECRET, { expiresIn: '7d' });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}
function publicUser(row) {
  if (!row) return null;
  const { id, email, display_name, home_lat, home_lng, viz_mode, avatar } = row;
  return { id, email, display_name, home_lat, home_lng, viz_mode, avatar };
}
function requireAuth(db) {
  const getUser = db.prepare(`SELECT ${PUBLIC_COLS} FROM users WHERE id = ?`);
  // async: la consulta a la base ahora devuelve promesa. Express 5 propaga solo el rechazo
  // de un middleware async al manejador de errores, así que no hace falta try/catch acá.
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = token && verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'no autorizado' });
    const user = await getUser.get(payload.uid);
    if (!user) return res.status(401).json({ error: 'no autorizado' });
    req.user = user;
    next();
  };
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, publicUser, requireAuth, PUBLIC_COLS };
