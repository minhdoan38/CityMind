import { describe, expect, it } from "vitest";

import {
  CONFIDENCE_GOV_THRESHOLD,
  evaluateRoutingPolicy,
  ROUTING_POLICY_VERSION,
} from "./policy";

describe("evaluateRoutingPolicy", () => {
  it("exports semver ROUTING_POLICY_VERSION", () => {
    expect(ROUTING_POLICY_VERSION).toBe("1.1.0");
  });

  it("routes manual_review to government with triage_manual_or_failed (D-23)", () => {
    const decision = evaluateRoutingPolicy({
      triageStatus: "manual_review",
      category: "pothole",
      severity: 1,
      priority: "low",
      confidence: 0.9,
    });
    expect(decision).toEqual({
      destination: "government",
      reasonCode: "triage_manual_or_failed",
      policyVersion: ROUTING_POLICY_VERSION,
    });
  });

  it("routes failed triage to government with triage_manual_or_failed (D-23)", () => {
    const decision = evaluateRoutingPolicy({
      triageStatus: "failed",
      category: null,
      severity: null,
      priority: null,
      confidence: null,
    });
    expect(decision.destination).toBe("government");
    expect(decision.reasonCode).toBe("triage_manual_or_failed");
  });

  it("routes severity >= 4 to government (D-21)", () => {
    const decision = evaluateRoutingPolicy({
      triageStatus: "completed",
      category: "pothole",
      severity: 4,
      priority: "low",
      confidence: 0.9,
    });
    expect(decision).toEqual({
      destination: "government",
      reasonCode: "severity_or_priority",
      policyVersion: ROUTING_POLICY_VERSION,
    });
  });

  it("routes high priority to government (D-21)", () => {
    const decision = evaluateRoutingPolicy({
      triageStatus: "completed",
      category: "waste",
      severity: 2,
      priority: "high",
      confidence: 0.9,
    });
    expect(decision.destination).toBe("government");
    expect(decision.reasonCode).toBe("severity_or_priority");
  });

  it("routes critical priority to government (D-21)", () => {
    const decision = evaluateRoutingPolicy({
      triageStatus: "completed",
      category: "streetlight",
      severity: 2,
      priority: "critical",
      confidence: 0.9,
    });
    expect(decision.destination).toBe("government");
    expect(decision.reasonCode).toBe("severity_or_priority");
  });

  it(`routes confidence below ${CONFIDENCE_GOV_THRESHOLD} to government (D-24)`, () => {
    const decision = evaluateRoutingPolicy({
      triageStatus: "completed",
      category: "pothole",
      severity: 2,
      priority: "low",
      confidence: CONFIDENCE_GOV_THRESHOLD - 0.01,
    });
    expect(decision).toEqual({
      destination: "government",
      reasonCode: "low_confidence",
      policyVersion: ROUTING_POLICY_VERSION,
    });
  });

  it("routes eligible graffiti category with severity <= 2 to self_help (D-22)", () => {
    const decision = evaluateRoutingPolicy({
      triageStatus: "completed",
      category: "graffiti",
      severity: 2,
      priority: "low",
      confidence: 0.8,
    });
    expect(decision).toEqual({
      destination: "self_help",
      reasonCode: "eligible_category_low_severity",
      policyVersion: ROUTING_POLICY_VERSION,
    });
  });

  it("routes eligible pothole severity 2 to self_help", () => {
    const decision = evaluateRoutingPolicy({
      triageStatus: "completed",
      category: "pothole",
      severity: 2,
      priority: "medium",
      confidence: 0.75,
    });
    expect(decision.destination).toBe("self_help");
    expect(decision.reasonCode).toBe("eligible_category_low_severity");
  });

  it("routes ineligible category to default_government", () => {
    const decision = evaluateRoutingPolicy({
      triageStatus: "completed",
      category: "flooding",
      severity: 2,
      priority: "low",
      confidence: 0.9,
    });
    expect(decision).toEqual({
      destination: "government",
      reasonCode: "default_government",
      policyVersion: ROUTING_POLICY_VERSION,
    });
  });

  it("routes eligible category with severity 3 to default_government", () => {
    const decision = evaluateRoutingPolicy({
      triageStatus: "completed",
      category: "waste",
      severity: 3,
      priority: "low",
      confidence: 0.9,
    });
    expect(decision.destination).toBe("government");
    expect(decision.reasonCode).toBe("default_government");
  });

  it("is deterministic and does not mutate inputs", () => {
    const input = {
      triageStatus: "completed",
      category: "streetlight",
      severity: 1,
      priority: "low" as const,
      confidence: 0.85,
    };
    expect(evaluateRoutingPolicy(input)).toEqual(evaluateRoutingPolicy(input));
  });

  describe("Hanoi handling_type routing (D-15-04)", () => {
    it("routes handling_type 1 + script_ready to self_help", () => {
      const decision = evaluateRoutingPolicy({
        triageStatus: "completed",
        category: "waste",
        severity: 1,
        priority: "low",
        confidence: 0.9,
        handling_type: 1,
        guidance_status: "script_ready",
      });
      expect(decision).toEqual({
        destination: "self_help",
        reasonCode: "hanoi_self_guidance",
        policyVersion: ROUTING_POLICY_VERSION,
      });
    });

    it("routes handling_type 2 to government", () => {
      const decision = evaluateRoutingPolicy({
        triageStatus: "completed",
        category: "pothole",
        severity: 2,
        priority: "low",
        confidence: 0.9,
        handling_type: 2,
        guidance_status: "script_ready",
      });
      expect(decision.destination).toBe("government");
      expect(decision.reasonCode).toBe("handling_type_government");
    });

    it("routes handling_type 3 to government", () => {
      const decision = evaluateRoutingPolicy({
        triageStatus: "completed",
        category: "obstruction",
        severity: 4,
        priority: "high",
        confidence: 0.9,
        handling_type: 3,
        guidance_status: "script_ready",
      });
      expect(decision).toEqual({
        destination: "government",
        reasonCode: "handling_type_government",
        policyVersion: ROUTING_POLICY_VERSION,
      });
    });

    it("routes guidance_status generate_later to government with guidance_pending", () => {
      const decision = evaluateRoutingPolicy({
        triageStatus: "completed",
        category: "waste",
        severity: 1,
        priority: "low",
        confidence: 0.9,
        handling_type: 1,
        guidance_status: "generate_later",
      });
      expect(decision).toEqual({
        destination: "government",
        reasonCode: "guidance_pending",
        policyVersion: ROUTING_POLICY_VERSION,
      });
    });

    it("routes critical_alert to government before handling_type self_help", () => {
      const decision = evaluateRoutingPolicy({
        triageStatus: "completed",
        category: "waste",
        severity: 1,
        priority: "low",
        confidence: 0.9,
        handling_type: 1,
        guidance_status: "script_ready",
        critical_alert: true,
      });
      expect(decision).toEqual({
        destination: "government",
        reasonCode: "critical_alert",
        policyVersion: ROUTING_POLICY_VERSION,
      });
    });

    it("falls back to legacy rules when handling_type is absent", () => {
      const decision = evaluateRoutingPolicy({
        triageStatus: "completed",
        category: "graffiti",
        severity: 2,
        priority: "low",
        confidence: 0.8,
      });
      expect(decision.reasonCode).toBe("eligible_category_low_severity");
    });
  });
});
