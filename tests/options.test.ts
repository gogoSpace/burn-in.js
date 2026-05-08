import { describe, expect, it } from "vitest";
import { resolveBurnOptions } from "../src/core/options";

describe("resolveBurnOptions", () => {
  it("applies presets and user overrides deeply", () => {
    const options = resolveBurnOptions({
      preset: "wildfire",
      fire: {
        intensity: 2,
        colors: [{ at: 0, color: "red" }],
      },
      smoke: {
        enabled: false,
      },
    });

    expect(options.preset).toBe("wildfire");
    expect(options.fire.intensity).toBe(2);
    expect(options.fire.colors).toEqual([{ at: 0, color: "red" }]);
    expect(options.fire.maxParticles).toBe(2400);
    expect(options.smoke.enabled).toBe(false);
    expect(options.smoke.maxParticles).toBe(1900);
  });

  it("keeps a complete resolved shape for minimal options", () => {
    const options = resolveBurnOptions();

    expect(options.timing.igniteMs).toBeGreaterThan(0);
    expect(options.fire.colors.length).toBeGreaterThan(0);
    expect(options.smoke.colors.length).toBeGreaterThan(0);
    expect(options.mask.padding.top).toBeGreaterThan(0);
  });

  it("accepts text as a mask source", () => {
    const options = resolveBurnOptions({
      mask: {
        source: "text",
        offset: {
          y: 6,
        },
      },
    });

    expect(options.mask.source).toBe("text");
    expect(options.mask.offset.x).toBe(0);
    expect(options.mask.offset.y).toBe(6);
  });
});
