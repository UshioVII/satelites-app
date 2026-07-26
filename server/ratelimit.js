// ponytail: rate limiter en memoria por-proceso. Suficiente para un solo proceso;
// si escalás a multi-instancia, mové el store a Redis (o usa express-rate-limit + store).
//
// Cuenta SOLO intentos fallidos (status >= 400, menos el propio 429): un login o
// registro exitoso no gasta presupuesto, así un usuario legítimo nunca se autobloquea.
// El freno es contra fuerza bruta / enumeración, no contra uso normal.
// En dev todo el tráfico entra por loopback (127.0.0.1 / ::1); ahí NO limitamos, porque
// un solo test fallido bloquearía al usuario real (misma IP para todos). En prod, detrás
// de Caddy con trust proxy, req.ip es la IP real del cliente y el límite sí aplica.
const isLoopback = (ip) => ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

// countAll=true cuenta también las requests exitosas. Se usa en el proxy de CelesTrak, donde
// lo que hay que frenar es el volumen (ancho de banda), no los intentos fallidos.
function rateLimit({ windowMs, max, countAll = false, message = 'demasiados intentos fallidos, esperá unos minutos' }) {
  const fails = new Map(); // ip -> number[] (timestamps de requests contadas dentro de la ventana)
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    if (isLoopback(key)) return next();
    const arr = (fails.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      fails.set(key, arr);
      return res.status(429).json({ error: message });
    }
    if (arr.length) fails.set(key, arr);
    else fails.delete(key); // sin fallos vigentes: no ocupamos memoria
    if (fails.size > 5000) for (const [k, v] of fails) if (!v.some((t) => now - t < windowMs)) fails.delete(k);
    res.on('finish', () => {
      if ((countAll || res.statusCode >= 400) && res.statusCode !== 429) {
        const cur = fails.get(key) || [];
        cur.push(Date.now());
        fails.set(key, cur);
      }
    });
    next();
  };
}

module.exports = { rateLimit };
