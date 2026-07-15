import { Sat } from '../satellites.service';

// La fuente TLE a veces trae el mismo satélite repetido. Deduplicamos por NORAD id
// (satrec.satnum), conservando la primera aparición.
export function dedupeSats(sats: Sat[]): Sat[] {
  const seen = new Set<string>();
  const out: Sat[] = [];
  for (const s of sats) {
    const id = String(s.satrec.satnum);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(s);
  }
  return out;
}
