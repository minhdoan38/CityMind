import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

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

loadEnvFile(".env.local");
loadEnvFile(".env");

const client = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data, error } = await client
    .from("reports")
    .select(
      "report_id,description,category,severity,priority,routing_destination,triage_status,summary,recommendation",
    )
    .ilike("description", "%BROWSER-%")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

void main();
