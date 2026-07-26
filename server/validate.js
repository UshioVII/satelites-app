// Topes de longitud. Sin esto el único freno era el límite de 100 kB de express.json(), o sea
// que un usuario logueado podía meter 100 kB por nota y por nombre de satélite en la base.
const MAX = {
  display_name: 60,
  password: 200, // bcrypt igual trunca a 72 bytes; el tope es para no hashear basura enorme
  note_body: 5000,
  sat_name: 120,
};

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254; // 254 = tope del RFC 5321
}

function registerErrors({ email, password, display_name }) {
  if (!isEmail(email)) return 'email inválido';
  if (typeof password !== 'string' || password.length < 8) return 'password mínimo 8 caracteres';
  if (password.length > MAX.password) return `password máximo ${MAX.password} caracteres`;
  if (typeof display_name !== 'string' || !display_name.trim()) return 'nombre requerido';
  if (display_name.trim().length > MAX.display_name) return `nombre máximo ${MAX.display_name} caracteres`;
  return null;
}

module.exports = { isEmail, registerErrors, MAX };
