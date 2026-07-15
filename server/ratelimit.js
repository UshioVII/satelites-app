// ponytail: rate limiter en memoria por-proceso. Suficiente para un solo proceso;
// si escalás a multi-instancia, mové el store a Redis (o usa express-rate-limit + store).
//
// Cuenta SOLO intentos fallidos (status >= 400, menos el propio 429): un login o
// registro exitoso no gasta presupuesto, así un usuario legítimo nunca se autobloquea.
// El freno es contra fuerza bruta / enumeración, no contra uso normal.
function rateLimit({ windowMs, max, message = 'demasiados intentos fallidos, esperá unos minutos' }) {
  const fails = new Map(); // ip -> number[] (timestamps de fallos dentro de la ventana)
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const arr = (fails.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      fails.set(key, arr);
      return res.status(429).json({ error: message });
    }
    if (arr.length) fails.set(key, arr);
    else fails.delete(key); // sin fallos vigentes: no ocupamos memoria
    if (fails.size > 5000) for (const [k, v] of fails) if (!v.some((t) => now - t < windowMs)) fails.delete(k);
    res.on('finish', () => {
      if (res.statusCode >= 400 && res.statusCode !== 429) {
        const cur = fails.get(key) || [];
        cur.push(Date.now());
        fails.set(key, cur);
      }
    });
    next();
  };
}

module.exports = { rateLimit };
