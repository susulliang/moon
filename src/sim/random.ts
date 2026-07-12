// ============================================================================
// Seeded RNG (mulberry32) + helpers
// ============================================================================

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(randRange(rng, min, max + 1));
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function makeSeedFromTime(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

// value-noise 2D: returns 0..1
export function makeValueNoise2D(seed: number) {
  const rng = mulberry32(seed);
  const tableSize = 256;
  const table = new Float32Array(tableSize * tableSize);
  for (let i = 0; i < table.length; i++) table[i] = rng();
  const perm = new Uint16Array(tableSize * 2);
  for (let i = 0; i < tableSize; i++) perm[i] = i;
  // shuffle
  for (let i = tableSize - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  for (let i = 0; i < tableSize; i++) perm[i + tableSize] = perm[i];

  const hash = (x: number, y: number) => {
    const xi = perm[(x & 255)] & 255;
    const yi = perm[(xi + (y & 255)) & 511] & 255;
    return table[yi * tableSize + xi];
  };

  const smooth = (t: number) => t * t * (3 - 2 * t);

  const noise = (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const sx = smooth(x - x0);
    const sy = smooth(y - y0);
    const n00 = hash(x0, y0);
    const n10 = hash(x1, y0);
    const n01 = hash(x0, y1);
    const n11 = hash(x1, y1);
    const ix0 = n00 + (n10 - n00) * sx;
    const ix1 = n01 + (n11 - n01) * sx;
    return ix0 + (ix1 - ix0) * sy;
  };

  // fractal Brownian motion (octave sum)
  const fbm = (x: number, y: number, octaves = 5, lacunarity = 2.0, gain = 0.5) => {
    let amp = 0.5;
    let freq = 1.0;
    let sum = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * freq, y * freq);
      freq *= lacunarity;
      amp *= gain;
    }
    return sum;
  };

  return { noise, fbm };
}
