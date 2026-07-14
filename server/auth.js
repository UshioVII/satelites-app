const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
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
