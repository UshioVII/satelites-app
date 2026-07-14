import { bucketByElevation, passesToSeries } from './stats.util';

describe('stats.util', () => {
  it('bucketByElevation agrupa por rango y siempre da 3 buckets', () => {
    const r = bucketByElevation([{ elevation: 10 }, { elevation: 25 }, { elevation: 45 }, { elevation: 80 }]);
    expect(r.map((b) => b.count)).toEqual([2, 1, 1]); // 0-30: 10,25 | 30-60: 45 | 60-90: 80
    expect(r.map((b) => b.label)).toEqual(['0–30°', '30–60°', '60–90°']);
  });

  it('bucketByElevation con lista vacía da los 3 buckets en 0', () => {
    expect(bucketByElevation([]).map((b) => b.count)).toEqual([0, 0, 0]);
  });

  it('passesToSeries mapea a horas y elevación máxima redondeada', () => {
    const s = passesToSeries([
      { start: new Date('2026-07-14T20:05:00'), maxElevation: 42.7 },
      { start: new Date('2026-07-14T21:30:00'), maxElevation: 10.2 },
    ]);
    expect(s.data).toEqual([43, 10]);
    expect(s.labels.length).toBe(2);
    expect(s.labels[0]).toMatch(/20:05/);
  });
});
