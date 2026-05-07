import type { BurnRange } from "./types";

function hashSeed(seed: string | number | undefined): number {
  const seedText = String(seed ?? Date.now());
  let hash = 2166136261;

  for (let index = 0; index < seedText.length; index += 1) {
    hash ^= seedText.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export class BurnRandom {
  private state: number;

  public constructor(seed?: string | number) {
    this.state = hashSeed(seed);
  }

  public next(): number {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  public between(range: BurnRange): number {
    if (typeof range === "number") {
      return range;
    }

    const [minimum, maximum] = range;

    return minimum + (maximum - minimum) * this.next();
  }

  public integer(maximumExclusive: number): number {
    return Math.floor(this.next() * maximumExclusive);
  }

  public signed(amount = 1): number {
    return (this.next() - 0.5) * amount;
  }
}
