import { describe, expect, it } from "vitest";

import type { HanoiAnalysis } from "@/server/domain/hanoi-analysis";
import { validateHanoiPolicy } from "./hanoi-policy";

function validAnalysis(overrides: Partial<HanoiAnalysis> = {}): HanoiAnalysis {
  return {
    category: "waste",
    matched_known_issue: true,
    observed_facts: ["Three intact empty plastic bottles are on a dry private path."],
    inferences: [],
    unknowns: [],
    severity: "low",
    severity_reason: "The small safe items cause only a localized inconvenience.",
    confidence: 0.9,
    handling_type: 1,
    handling_label: "SELF_GUIDANCE",
    allowed_actions: ["Collect the bottles only if safe."],
    prohibited_actions: ["Do not enter traffic."],
    recommended_action: "No urgent municipal intervention is indicated.",
    guidance_code: "self_collect_safe_litter",
    critical_alert: false,
    requires_human_review: true,
    ...overrides,
  };
}

describe("validateHanoiPolicy", () => {
  it("accepts the LOW micro-example from Hanoi v5.2", () => {
    expect(validateHanoiPolicy(validAnalysis())).toEqual({ ok: true });
  });

  it("accepts the MEDIUM micro-example from Hanoi v5.2", () => {
    const result = validateHanoiPolicy(
      validAnalysis({
        category: "pothole",
        observed_facts: ["A large pothole occupies part of one traffic lane."],
        inferences: ["The defect may materially impair mobility."],
        unknowns: ["Pothole depth is unknown."],
        severity: "medium",
        severity_reason:
          "The road defect materially impairs normal lane use without an explicit active hazard.",
        handling_type: 2,
        handling_label: "TEMPORARY_SAFE_ACTION",
        allowed_actions: ["Report the exact location from a safe position."],
        prohibited_actions: ["Do not enter the traffic lane or repair the road."],
        recommended_action: "Inspect and schedule authorized road repair.",
        guidance_code: "report_road_damage",
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("accepts the HIGH micro-example from Hanoi v5.2", () => {
    const result = validateHanoiPolicy(
      validAnalysis({
        category: "waste",
        observed_facts: ["A discarded syringe is visible on a public pavement."],
        inferences: ["The sharp item presents a credible contact hazard."],
        unknowns: ["Its contents are unknown."],
        severity: "high",
        severity_reason: "The directly visible sharp medical item is a credible safety hazard.",
        handling_type: 3,
        handling_label: "KEEP_AWAY",
        allowed_actions: ["Keep away and report the exact location."],
        prohibited_actions: ["Do not touch or move the syringe."],
        recommended_action: "Arrange authorized sharps collection.",
        guidance_code: "generate_later",
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("accepts the CRITICAL micro-example from Hanoi v5.2", () => {
    const result = validateHanoiPolicy(
      validAnalysis({
        category: "obstruction",
        observed_facts: ["A tree is visibly cracking and leaning over an occupied bus stop."],
        inferences: ["The cracking tree presents an imminent falling-object danger."],
        unknowns: ["The tree's structural condition is unknown."],
        severity: "critical",
        severity_reason:
          "A cracking tree leaning over an occupied area is a directly evidenced imminent danger.",
        handling_type: 3,
        handling_label: "KEEP_AWAY",
        allowed_actions: ["Move far outside the potential fall area and report the exact location."],
        prohibited_actions: ["Do not approach, touch, or stand beneath the tree."],
        recommended_action: "Escalate immediately to authorized tree-hazard personnel.",
        guidance_code: "generate_later",
        critical_alert: true,
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects handling_type 1 when severity is not low", () => {
    const result = validateHanoiPolicy(
      validAnalysis({
        severity: "medium",
        handling_type: 1,
        handling_label: "SELF_GUIDANCE",
        guidance_code: "report_road_damage",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.violations.some((v) => v.code === "handling_type_1_requires_low_severity"),
      ).toBe(true);
    }
  });

  it("rejects handling_type 3 when severity is low or medium", () => {
    const result = validateHanoiPolicy(
      validAnalysis({
        severity: "medium",
        handling_type: 3,
        handling_label: "KEEP_AWAY",
        guidance_code: "generate_later",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.violations.some((v) => v.code === "handling_type_3_requires_high_or_critical"),
      ).toBe(true);
    }
  });

  it("rejects critical_alert true when severity is not critical", () => {
    const result = validateHanoiPolicy(
      validAnalysis({
        severity: "high",
        handling_type: 3,
        handling_label: "KEEP_AWAY",
        guidance_code: "generate_later",
        critical_alert: true,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.violations.some((v) => v.code === "critical_alert_requires_critical_severity"),
      ).toBe(true);
    }
  });

  it("rejects critical severity without critical_alert", () => {
    const result = validateHanoiPolicy(
      validAnalysis({
        severity: "critical",
        handling_type: 3,
        handling_label: "KEEP_AWAY",
        guidance_code: "generate_later",
        critical_alert: false,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.violations.some((v) => v.code === "critical_severity_requires_critical_alert"),
      ).toBe(true);
    }
  });

  it("rejects matched_known_issue false when category is not other", () => {
    const result = validateHanoiPolicy(
      validAnalysis({
        category: "waste",
        matched_known_issue: false,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.some((v) => v.code === "matched_known_issue_must_be_true")).toBe(
        true,
      );
    }
  });

  it("rejects self_* guidance_code when handling_type is not 1", () => {
    const result = validateHanoiPolicy(
      validAnalysis({
        handling_type: 2,
        handling_label: "TEMPORARY_SAFE_ACTION",
        guidance_code: "self_collect_safe_litter",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.violations.some((v) => v.code === "self_guidance_code_requires_handling_type_1"),
      ).toBe(true);
    }
  });
});
