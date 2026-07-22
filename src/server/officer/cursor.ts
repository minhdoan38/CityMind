export function encodeCursor(
  sort: string,
  order: string,
  value: string,
  reportId: string,
): string {
  const raw = `${sort}:${order}:${value}:${reportId}`;
  return Buffer.from(raw, "utf8").toString("base64url").replace(/=+$/g, "");
}

export function decodeCursor(cursor: string): [string, string, string, string] {
  const pad = "=".repeat((4 - (cursor.length % 4)) % 4);
  const raw = Buffer.from(cursor + pad, "base64url").toString("utf8");
  const first = raw.indexOf(":");
  const second = raw.indexOf(":", first + 1);
  const last = raw.lastIndexOf(":");
  if (first <= 0 || second <= first || last <= second || last === raw.length - 1) {
    throw new Error("Invalid cursor");
  }
  return [
    raw.slice(0, first),
    raw.slice(first + 1, second),
    raw.slice(second + 1, last),
    raw.slice(last + 1),
  ];
}
