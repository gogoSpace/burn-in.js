import { describe, expect, it } from "vitest";
import { BurnRandom } from "../src/core/random";

describe("BurnRandom", () => {
  it("returns reproducible sequences for the same seed", () => {
    const firstGenerator = new BurnRandom("demo-seed");
    const secondGenerator = new BurnRandom("demo-seed");

    const firstSequence = Array.from({ length: 6 }, () => firstGenerator.next());
    const secondSequence = Array.from({ length: 6 }, () => secondGenerator.next());

    expect(firstSequence).toEqual(secondSequence);
  });

  it("resolves numeric and tuple ranges", () => {
    const generator = new BurnRandom("ranges");

    expect(generator.between(12)).toBe(12);
    expect(generator.between([5, 10])).toBeGreaterThanOrEqual(5);
    expect(generator.between([5, 10])).toBeLessThanOrEqual(10);
  });
});
