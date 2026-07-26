// Headers de seguridad, a mano y sin dependencia: son ocho líneas de cabeceras estáticas
// y helmet traería 20 defaults que igual habría que auditar uno por uno.

// CSP pensada para esta app concreta:
// - 'unsafe-inline' en style-src es obligatorio: Angular inyecta los estilos de cada
//   componente en <style>. Sacarlo requiere migrar a nonces (ngCspNonce) y deja la app en blanco.
// - blob: en img-src/worker-src lo necesitan three.js y globe.gl para las texturas del globo.
// - connect-src 'self' alcanza: CelesTrak se consume por nuestro propio proxy /celestrak.
// - frame-ancestors 'none' es lo que corta el clickjacking (X-Frame-Options es el equivalente viejo).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function securityHeaders({ production = process.env.NODE_ENV === 'production' } = {}) {
  return (req, res, next) => {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // La app pide la ubicación para "satélites sobre mi cabeza", así que geolocation queda
    // habilitada para el propio origen. Todo lo demás, cerrado.
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()');
    res.removeHeader('X-Powered-By'); // no anunciar que corre Express
    // HSTS solo en producción: en dev la app es http://localhost y esto la dejaría inaccesible
    // en el navegador durante un año.
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}

module.exports = { securityHeaders, CSP };
