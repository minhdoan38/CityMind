import { redirect } from "next/navigation";

/** Unprefixed /report bypasses locale prefixes — send citizens to default locale. */
export default function PublicReportRedirectPage() {
  redirect("/en/report");
}
