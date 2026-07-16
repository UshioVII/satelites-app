import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, timeout, catchError, switchMap, of, shareReplay } from 'rxjs';
import * as satellite from 'satellite.js';

// Un satelite ya parseado: su nombre + el "satrec" (los parametros de su orbita)
export interface Sat {
  name: string;
  satrec: ReturnType<typeof satellite.twoline2satrec>;
}
// Un satelite posicionado en un instante, con telemetria
export interface PosSat {
  name: string;
  norad: number; // NORAD id (satnum) — identidad estable; los nombres se repiten en el set visual
  lat: number;
  lng: number;
  alt: number; // altitud relativa al radio terrestre (para globe.gl)
  altKm: number; // altitud en km
  speed: number; // velocidad en km/s
  periodMin: number; // periodo orbital en minutos
  inclDeg: number; // inclinacion de la orbita en grados
}
// Un punto de la orbita (solo lat/lng)
export interface OrbitPoint {
  lat: number;
  lng: number;
}
// Un satelite visible desde una ubicacion (por encima del horizonte)
export interface OverheadSat {
  name: string;
  elevation: number; // grados sobre el horizonte (90 = justo arriba)
  azimuth: number; // grados (0=N, 90=E, 180=S, 270=O)
  rangeKm: number; // distancia al satelite en km
}
// Un pase futuro del satelite sobre una ubicacion (sale y se pone en el horizonte)
export interface Pass {
  start: Date; // sale por el horizonte
  peak: Date; // punto mas alto
  end: Date; // se pone
  maxElevation: number; // grados de elevacion en el pico
  startAz: number; // azimut al salir
  endAz: number; // azimut al ponerse
  durationMin: number;
}

// Azimut (grados) -> punto cardinal de 8 vientos.
export function compass(az: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(((az % 360) + 360) % 360 / 45) % 8];
}

@Injectable({ providedIn: 'root' })
export class SatellitesService {
  private http = inject(HttpClient);

  // Caché de TLEs compartida por todos los consumidores (globo, perfil, stats). Sin esto, cada
  // componente pegaba a CelesTrak por separado en cada carga -> triple descarga y CelesTrak nos
  // bloqueaba por "excessive downloads". TTL 10 min (los TLE se actualizan 2-3 veces al día).
  private static readonly TLE_TTL = 10 * 60_000;
  private tleCache = new Map<string, { at: number; obs: Observable<{ sats: Sat[]; live: boolean }> }>();

  // Trae los TLE de un grupo de CelesTrak. Va por /celestrak (proxy) para evitar CORS.
  // force=true ignora la caché (para el botón "Reintentar en vivo").
  loadTLEs(group = 'visual', force = false): Observable<{ sats: Sat[]; live: boolean }> {
    const cached = this.tleCache.get(group);
    if (!force && cached && Date.now() - cached.at < SatellitesService.TLE_TTL) return cached.obs;

    const url = `/celestrak/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`;
    // timeout: si CelesTrak no responde, fallar en ~12s en vez de colgar en el timeout TCP del SO (~20s)
    const obs = this.http.get(url, { responseType: 'text' }).pipe(
      timeout(12_000),
      map((t) => this.parse(t)),
      switchMap((sats) => (sats.length ? of({ sats, live: true }) : this.loadBackup())),
      catchError(() => this.loadBackup()), // CelesTrak caido/timeout -> snapshot bundleado
      shareReplay(1), // una sola descarga compartida por todos los suscriptores
    );
    this.tleCache.set(group, { at: Date.now(), obs });
    return obs;
  }

  // Snapshot estatico bundleado (public/visual.tle) para que el globo nunca quede vacio y
  // la app funcione en produccion sin proxy. Posiciones aproximadas: el TLE esta congelado.
  private loadBackup(): Observable<{ sats: Sat[]; live: boolean }> {
    return this.http
      .get('visual.tle', { responseType: 'text' })
      .pipe(map((t) => ({ sats: this.parse(t), live: false })));
  }

  private parse(text: string): Sat[] {
    const lines = text.trim().split(/\r?\n/);
    const out: Sat[] = [];
    for (let i = 0; i + 2 < lines.length; i += 3) {
      try {
        out.push({
          name: lines[i].trim(),
          satrec: satellite.twoline2satrec(lines[i + 1], lines[i + 2]),
        });
      } catch {
        /* TLE roto: lo saltamos */
      }
    }
    return out;
  }

  // Propaga cada satelite a la fecha dada (SGP4) -> posicion + telemetria.
  positionsAt(sats: Sat[], date: Date): PosSat[] {
    const gmst = satellite.gstime(date);
    const out: PosSat[] = [];
    for (const s of sats) {
      const pv = satellite.propagate(s.satrec, date);
      const pos = pv?.position;
      const vel = pv?.velocity;
      // satrec.error lo setea SGP4 tras propagar (p. ej. objeto decaído). Sin posición o con error: fuera.
      if (!pos || typeof pos === 'boolean' || s.satrec.error) continue;
      const geo = satellite.eciToGeodetic(pos, gmst);
      // Con TLEs viejos (o de objetos decaídos como COSMOS 1408) SGP4 diverge y devuelve altitudes
      // absurdas (cientos de miles de km) que se dibujan como órbitas basura. Descartamos lo no físico.
      if (!Number.isFinite(geo.height) || geo.height < 80 || geo.height > 100000) continue;
      const speed =
        vel && typeof vel !== 'boolean'
          ? Math.hypot(vel.x, vel.y, vel.z) // km/s = modulo del vector velocidad
          : 0;
      out.push({
        name: s.name,
        norad: Number(s.satrec.satnum),
        lat: satellite.degreesLat(geo.latitude),
        lng: satellite.degreesLong(geo.longitude),
        alt: geo.height / 6371,
        altKm: geo.height,
        speed,
        periodMin: (2 * Math.PI) / s.satrec.no, // no = mean motion en rad/min
        inclDeg: (s.satrec.inclo * 180) / Math.PI,
      });
    }
    return out;
  }

  // Calcula la traza de la orbita completa (una vuelta) de un satelite: array de lat/lng.
  orbitPath(sat: Sat, date: Date, steps = 120): OrbitPoint[] {
    const periodMs = ((2 * Math.PI) / sat.satrec.no) * 60_000; // periodo en ms
    const pts: OrbitPoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = new Date(date.getTime() + periodMs * (i / steps));
      const pv = satellite.propagate(sat.satrec, t);
      const pos = pv?.position;
      if (!pos || typeof pos === 'boolean' || sat.satrec.error) continue;
      const geo = satellite.eciToGeodetic(pos, satellite.gstime(t));
      if (!Number.isFinite(geo.height) || geo.height < 80 || geo.height > 100000) continue; // ídem positionsAt: sin basura
      pts.push({ lat: satellite.degreesLat(geo.latitude), lng: satellite.degreesLong(geo.longitude) });
    }
    return pts;
  }

  // Que satelites estan por encima del horizonte desde una ubicacion (lat/lng), ahora.
  overhead(sats: Sat[], obsLat: number, obsLng: number, date: Date): OverheadSat[] {
    const gmst = satellite.gstime(date);
    const observer = {
      longitude: satellite.degreesToRadians(obsLng),
      latitude: satellite.degreesToRadians(obsLat),
      height: 0.1, // km sobre el nivel del mar
    };
    const out: OverheadSat[] = [];
    for (const s of sats) {
      const pv = satellite.propagate(s.satrec, date);
      const pos = pv?.position;
      if (!pos || typeof pos === 'boolean') continue;
      const ecf = satellite.eciToEcf(pos, gmst); // pasar a coords fijas a la Tierra
      const look = satellite.ecfToLookAngles(observer, ecf); // -> elevacion/azimut/distancia
      const elevation = satellite.radiansToDegrees(look.elevation);
      if (elevation > 0) {
        // elevacion > 0 = esta sobre el horizonte
        out.push({
          name: s.name,
          elevation,
          azimuth: satellite.radiansToDegrees(look.azimuth),
          rangeKm: look.rangeSat,
        });
      }
    }
    return out.sort((a, b) => b.elevation - a.elevation); // el mas alto primero
  }

  // Proximos pases visibles del satelite sobre una ubicacion, en las siguientes `hours`.
  // Un pase = tramo continuo con elevacion > 0; se descartan los que no superan minPeakDeg.
  nextPasses(sat: Sat, obsLat: number, obsLng: number, from: Date,
             hours = 48, minPeakDeg = 10, max = 5): Pass[] {
    const observer = {
      longitude: satellite.degreesToRadians(obsLng),
      latitude: satellite.degreesToRadians(obsLat),
      height: 0.1,
    };
    // ponytail: paso fijo de 30s; para precision al segundo en start/end haria falta biseccion
    const stepMs = 30_000;
    const endMs = from.getTime() + hours * 3_600_000;
    const passes: Pass[] = [];
    let cur: { start: Date; startAz: number; endAz: number; peak: Date; peakEl: number } | null = null;
    for (let t = from.getTime(); t <= endMs && passes.length < max; t += stepMs) {
      const date = new Date(t);
      const pv = satellite.propagate(sat.satrec, date);
      const pos = pv?.position;
      if (!pos || typeof pos === 'boolean') continue;
      const look = satellite.ecfToLookAngles(observer, satellite.eciToEcf(pos, satellite.gstime(date)));
      const el = satellite.radiansToDegrees(look.elevation);
      const az = satellite.radiansToDegrees(look.azimuth);
      if (el > 0) {
        if (!cur) cur = { start: date, startAz: az, endAz: az, peak: date, peakEl: el };
        else {
          cur.endAz = az;
          if (el > cur.peakEl) { cur.peakEl = el; cur.peak = date; }
        }
      } else if (cur) {
        if (cur.peakEl >= minPeakDeg) {
          passes.push({
            start: cur.start, peak: cur.peak, end: date,
            maxElevation: cur.peakEl, startAz: cur.startAz, endAz: cur.endAz,
            durationMin: (date.getTime() - cur.start.getTime()) / 60_000,
          });
        }
        cur = null;
      }
    }
    return passes;
  }
}
