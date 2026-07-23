import fs from "node:fs";
import path from "node:path";
import { buildHanoiSystemPrompt } from "@/server/ai/hanoi";
import { HanoiAnalysisSchema } from "@/server/domain/hanoi-analysis";

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvFile(path.resolve(".env.local"));
  loadEnvFile(path.resolve(".env"));

  const base = process.env.AI_BASE_URL?.replace(/\/+$/, "");
  const model = process.env.AI_MODEL;
  const key = process.env.THIRD_PARTY_API_KEY;
  const systemInstruction = buildHanoiSystemPrompt();
  const description =
    "Broken streetlight on Nguyen Hue street near the park entrance. It has been dark for three nights.";

  const endpoint = `${base}/chat/completions`;
  const started = Date.now();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 1200,
      stream: false,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: description },
      ],
      response_format: { type: "json_object" },
    }),
  });

  const text = await res.text();
  console.log("status", res.status, "ms", Date.now() - started);
  const payload = JSON.parse(text);
  const content = payload.choices?.[0]?.message?.content ?? "";
  console.log("content preview:\n", content.slice(0, 2000));

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error("JSON parse failed", error);
    process.exit(1);
  }

  const result = HanoiAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    console.error("Zod issues:");
    for (const issue of result.error.issues.slice(0, 15)) {
      console.error("-", issue.path.join("."), issue.message);
    }
    process.exit(1);
  }

  console.log("VALID", result.data.category, result.data.handling_type, result.data.guidance_code);
}

void main();
