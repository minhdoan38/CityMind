#!/usr/bin/env node
import { loadProjectEnv } from "./load-project-env.mjs";

const env = loadProjectEnv();
const base = env.AI_BASE_URL?.replace(/\/+$/, "");
const model = env.AI_MODEL;
const key = env.THIRD_PARTY_API_KEY;

if (!base || !model || !key) {
  console.error("Missing AI_BASE_URL, AI_MODEL, or THIRD_PARTY_API_KEY in .env.local");
  process.exit(1);
}

const endpoint = `${base}/chat/completions`;
const systemInstruction = `You are a city incident triage assistant. Respond with a single JSON object only.`;

const body = {
  model,
  temperature: 0.1,
  max_tokens: 1200,
  stream: false,
  messages: [
    { role: "system", content: systemInstruction },
    {
      role: "user",
      content:
        "Broken streetlight on Nguyen Hue street, dark for three nights. Return JSON with category, handling_type, summary.",
    },
  ],
  response_format: { type: "json_object" },
};

const started = Date.now();
const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log("status:", res.status, "in", Date.now() - started, "ms");
console.log("body:", text.slice(0, 800));
