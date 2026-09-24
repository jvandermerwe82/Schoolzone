/** Deterministic PRNG so every Brain version faces reproducible learners. */
export function seededRng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mixSeed(...values: number[]): number {
  let seed = 0x811c9dc5;
  for (const value of values) {
    seed ^= value | 0;
    seed = Math.imul(seed, 0x01000193);
  }
  return seed >>> 0;
}
