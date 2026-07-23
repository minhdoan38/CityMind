import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");

function read(rel) {
  return fs.readFileSync(path.resolve(root, rel), "utf8");
}

const widgetPath = "src/components/dashboard/widgets/AdvisoryAssistantWidget.tsx";

test("AdvisoryAssistantWidget exists", () => {
  assert.ok(fs.existsSync(path.resolve(root, widgetPath)), `${widgetPath} must exist`);
});

test("AdvisoryAssistantWidget polls AI health", () => {
  const src = read(widgetPath);
  assert.ok(src.includes('fetch("/api/health/ai"'), "widget must poll /api/health/ai");
});

test("AdvisoryAssistantWidget loads persisted history on mount", () => {
  const src = read(widgetPath);
  assert.ok(
    src.includes('fetch("/api/officer/assistant/messages")'),
    "widget must GET /api/officer/assistant/messages",
  );
  assert.ok(
    src.includes('method: "POST"') && src.includes('fetch("/api/officer/assistant/messages"'),
    "widget must POST to /api/officer/assistant/messages",
  );
});

test("AdvisoryAssistantWidget does not send client history", () => {
  const src = read(widgetPath);
  assert.ok(!src.includes("history:"), "POST body must not include client history");
  assert.ok(
    src.includes("JSON.stringify(payload)") || src.includes("JSON.stringify({ message"),
    "POST must stringify message-only payload",
  );
});

test("AdvisoryAssistantWidget blocks send only when AI is down", () => {
  const src = read(widgetPath);
  assert.ok(
    src.includes('aiStatus === "down"'),
    "aiUnavailable must use down-only gate",
  );
  assert.ok(
    !src.includes('aiStatus === "unknown"') || src.includes('aiStatus === "unknown" && "opacity-70"'),
    "unknown must not block send",
  );
});

test("AdvisoryAssistantWidget shows degraded warning", () => {
  const src = read(widgetPath);
  assert.ok(
    src.includes("assistantDegradedWarning"),
    "widget must use assistantDegradedWarning copy",
  );
  assert.ok(src.includes("Alert"), "widget must render degraded Alert");
});

test("AdvisoryAssistantWidget exposes live thread region", () => {
  const src = read(widgetPath);
  assert.ok(src.includes('aria-live="polite"'), "thread container must use aria-live");
  assert.ok(src.includes("BubbleContent"), "widget must render chat with Bubble components");
  assert.ok(src.includes("BubbleGroup"), "widget must group consecutive bubbles");
});
