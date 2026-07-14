// Agrupa satélites por rango de elevación (0–30, 30–60, 60–90 grados). Siempre 3 buckets.
export function bucketByElevation(sats: { elevation: number }[]): { label: string; count: number }[] {
  const buckets = [
    { label: '0–30°', count: 0 },
    { label: '30–60°', count: 0 },
    { label: '60–90°', count: 0 },
  ];
  for (const s of sats) {
    const i = s.elevation < 30 ? 0 : s.elevation < 60 ? 1 : 2;
    buckets[i].count++;
  }
  return buckets;
}

// Convierte una lista de pases en series para el gráfico: hora del pase + elevación máxima.
export function passesToSeries(passes: { start: Date; maxElevation: number }[]): { labels: string[]; data: number[] } {
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return {
    labels: passes.map((p) => hhmm(p.start)),
    data: passes.map((p) => Math.round(p.maxElevation)),
  };
}
