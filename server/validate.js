function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function registerErrors({ email, password, display_name }) {
  if (!isEmail(email)) return 'email inválido';
  if (typeof password !== 'string' || password.length < 8) return 'password mínimo 8 caracteres';
  if (typeof display_name !== 'string' || !display_name.trim()) return 'nombre requerido';
  return null;
}

module.exports = { isEmail, registerErrors };
