const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET es obligatorio en producción');
  // ponytail: en dev sin secreto usamos uno aleatorio efímero (los tokens no sobreviven a reinicios).
  // Cierra el forjado de tokens con el default público. Seteá JWT_SECRET para tokens estables.
  SECRET = require('node:crypto').randomBytes(32).toString('hex');
  console.warn('[auth] JWT_SECRET no seteado: secreto aleatorio efímero. Seteá JWT_SECRET para persistir sesiones.');
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
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = token && verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'no autorizado' });
    const user = getUser.get(payload.uid);
    if (!user) return res.status(401).json({ error: 'no autorizado' });
    req.user = user;
    next();
  };
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, publicUser, requireAuth, PUBLIC_COLS };
