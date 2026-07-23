import { describe, expect, it } from "vitest";

import { resolveGuidanceScript } from "./guidance-resolver";

describe("resolveGuidanceScript", () => {
  it("returns script_ready with vi-VN for self_collect_safe_litter low type 1 Vietnamese text", () => {
    const result = resolveGuidanceScript({
      guidance_code: "self_collect_safe_litter",
      handling_type: 1,
      severity: "low",
      report_text: "Có ba chai nhựa rỗng trên lối đi riêng khô ráo.",
    });

    expect(result.status).toBe("script_ready");
    if (result.status === "script_ready") {
      expect(result.locale).toBe("vi-VN");
      expect(result.script_id).toBe("vi_self_collect_safe_litter_v1");
      expect(result.text).toContain("thấp");
      expect(result.text).toContain("hướng dẫn loại 1");
    }
  });

  it("returns script_ready with en-US for report_road_damage medium type 2 English text", () => {
    const result = resolveGuidanceScript({
      guidance_code: "report_road_damage",
      handling_type: 2,
      severity: "medium",
      report_text: "A large pothole occupies part of one traffic lane.",
    });

    expect(result.status).toBe("script_ready");
    if (result.status === "script_ready") {
      expect(result.locale).toBe("en-US");
      expect(result.script_id).toBe("vi_report_road_damage_v1");
      expect(result.text).toContain("medium");
      expect(result.text).toContain("type 2 guidance");
    }
  });

  it("returns generate_later for high severity regardless of guidance_code", () => {
    const result = resolveGuidanceScript({
      guidance_code: "self_collect_safe_litter",
      handling_type: 3,
      severity: "high",
      report_text: "Discarded syringe on the pavement.",
    });

    expect(result).toEqual({ status: "generate_later", reason: "high_and_critical" });
  });

  it("returns generate_later when guidance_code is generate_later", () => {
    const result = resolveGuidanceScript({
      guidance_code: "generate_later",
      handling_type: 3,
      severity: "low",
      report_text: "Some issue.",
    });

    expect(result).toEqual({ status: "generate_later", reason: "explicit_code" });
  });

  it("returns generate_later when handling_type mismatches script required_handling_type", () => {
    const result = resolveGuidanceScript({
      guidance_code: "self_collect_safe_litter",
      handling_type: 2,
      severity: "low",
      report_text: "Three plastic bottles on a dry path.",
    });

    expect(result).toEqual({ status: "generate_later", reason: "handling_type_mismatch" });
  });

  it("returns generate_later when guidance_code is missing from catalog", () => {
    const result = resolveGuidanceScript({
      guidance_code: "nonexistent_guidance_code",
      handling_type: 1,
      severity: "low",
      report_text: "Some litter.",
    });

    expect(result).toEqual({ status: "generate_later", reason: "missing_code" });
  });
});
