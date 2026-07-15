// ponytail: rate limiter en memoria por-proceso. Suficiente para un solo proceso;
// si escalás a multi-instancia, mové el store a Redis (o usa express-rate-limit + store).
function rateLimit({ windowMs, max, message = 'demasiados intentos, probá más tarde' }) {
  const hits = new Map(); // ip -> { count, reset }
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let rec = hits.get(key);
    if (!rec || now > rec.reset) {
      rec = { count: 0, reset: now + windowMs };
      hits.set(key, rec);
      if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k); // prune expirados
    }
    rec.count++;
    if (rec.count > max) return res.status(429).json({ error: message });
    next();
  };
}

module.exports = { rateLimit };
