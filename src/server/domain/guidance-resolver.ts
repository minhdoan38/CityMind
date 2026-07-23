import { readFileSync } from "node:fs";
import path from "node:path";

import type { HanoiSeverity } from "./hanoi-analysis";

const GUIDANCE_CATALOG_PATH = path.resolve(
  process.cwd(),
  "prompt/citymind_hanoi_guidance_scripts_v2_bilingual (1).json",
);

type ScriptCatalog = {
  template_variables: {
    severity_label: Record<
      "vi-VN" | "en-US",
      Partial<Record<"low" | "medium", string>>
    >;
  };
  scripts: Array<{
    script_id: string;
    guidance_code: string;
    allowed_severity: string[];
    required_handling_type: 1 | 2 | 3;
    citizen_guidance_templates: Partial<Record<"vi-VN" | "en-US", string>>;
  }>;
};

let cachedCatalog: ScriptCatalog | null = null;

function loadScriptCatalog(): ScriptCatalog {
  if (cachedCatalog) {
    return cachedCatalog;
  }
  cachedCatalog = JSON.parse(readFileSync(GUIDANCE_CATALOG_PATH, "utf8")) as ScriptCatalog;
  return cachedCatalog;
}

const VIETNAMESE_DIACRITIC = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const VIETNAMESE_WORD =
  /\b(có|và|là|một|người|đường|phố|gần|bị|đang|trên|dưới|của|không|này|đó|với|cho|tôi|nhà|rác|cống|nước|hãy|đã|được|nhìn|thấy)\b/i;

export function inferOutputLanguage(reportText: string): "vi-VN" | "en-US" {
  const text = reportText.trim();
  if (!text) {
    return "en-US";
  }

  const diacriticCount = (text.match(new RegExp(VIETNAMESE_DIACRITIC.source, "gi")) ?? []).length;
  const vietnameseWordCount = (text.match(new RegExp(VIETNAMESE_WORD.source, "gi")) ?? []).length;

  if (diacriticCount >= 2 || vietnameseWordCount >= 2) {
    return "vi-VN";
  }

  return "en-US";
}

export type GuidanceResolution =
  | { status: "script_ready"; script_id: string; text: string; locale: "vi-VN" | "en-US" }
  | { status: "generate_later"; reason: string };

export function resolveGuidanceScript(input: {
  guidance_code: string;
  handling_type: 1 | 2 | 3;
  severity: HanoiSeverity;
  report_text: string;
}): GuidanceResolution {
  if (input.severity === "high" || input.severity === "critical") {
    return { status: "generate_later", reason: "high_and_critical" };
  }

  if (input.guidance_code === "generate_later") {
    return { status: "generate_later", reason: "explicit_code" };
  }

  const catalog = loadScriptCatalog();
  const script = catalog.scripts.find((entry) => entry.guidance_code === input.guidance_code);
  if (!script) {
    return { status: "generate_later", reason: "missing_code" };
  }

  if (!script.allowed_severity.includes(input.severity)) {
    return { status: "generate_later", reason: "severity_mismatch" };
  }

  if (script.required_handling_type !== input.handling_type) {
    return { status: "generate_later", reason: "handling_type_mismatch" };
  }

  const locale = inferOutputLanguage(input.report_text);
  const template = script.citizen_guidance_templates[locale];
  if (!template) {
    return { status: "generate_later", reason: "unsupported_locale" };
  }

  const severityKey = input.severity === "low" || input.severity === "medium" ? input.severity : "low";
  const severityLabel =
    catalog.template_variables.severity_label[locale]?.[severityKey] ?? input.severity;
  const text = template.replaceAll("{{severity_label}}", severityLabel);

  return {
    status: "script_ready",
    script_id: script.script_id,
    text,
    locale,
  };
}
