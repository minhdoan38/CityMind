import { describe, expect, it } from "vitest";

import {
  applySeverityPreset,
  resolveSeverityPresetKey,
  severityFilterActive,
} from "./severity-filter-presets";

describe("resolveSeverityPresetKey", () => {
  it("returns any when both params are empty", () => {
    expect(resolveSeverityPresetKey(undefined, undefined)).toBe("any");
    expect(resolveSeverityPresetKey("", "")).toBe("any");
  });

  it("maps preset combinations", () => {
    expect(resolveSeverityPresetKey("1", "2")).toBe("low");
    expect(resolveSeverityPresetKey("3", undefined)).toBe("midPlus");
    expect(resolveSeverityPresetKey("4", "")).toBe("highPlus");
    expect(resolveSeverityPresetKey("5", "5")).toBe("critical");
  });

  it("returns null for custom combinations", () => {
    expect(resolveSeverityPresetKey("2", "5")).toBeNull();
    expect(resolveSeverityPresetKey("1", "5")).toBeNull();
    expect(resolveSeverityPresetKey(undefined, "3")).toBeNull();
  });
});

describe("applySeverityPreset", () => {
  it("clears params for any", () => {
    const params = new URLSearchParams({
      min_severity: "4",
      max_severity: "5",
    });
    applySeverityPreset(params, "any");
    expect(params.get("min_severity")).toBeNull();
    expect(params.get("max_severity")).toBeNull();
  });

  it("sets min only for high-plus preset", () => {
    const params = new URLSearchParams();
    applySeverityPreset(params, "highPlus");
    expect(params.get("min_severity")).toBe("4");
    expect(params.get("max_severity")).toBeNull();
  });

  it("sets both bounds for low preset", () => {
    const params = new URLSearchParams();
    applySeverityPreset(params, "low");
    expect(params.get("min_severity")).toBe("1");
    expect(params.get("max_severity")).toBe("2");
  });
});

describe("severityFilterActive", () => {
  it("detects active severity filters", () => {
    expect(severityFilterActive(undefined, undefined)).toBe(false);
    expect(severityFilterActive("4", undefined)).toBe(true);
    expect(severityFilterActive(undefined, "2")).toBe(true);
  });
});
