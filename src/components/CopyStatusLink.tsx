"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  reportId: string;
  embedded?: boolean;
};

/**
 * Officer DASH-08 control: copies reportId-only status URL (no token).
 * Plaintext tokens are hash-at-rest only — never reconstruct (D-14a / D-14c).
 */
export default function CopyStatusLink({ reportId, embedded = false }: Props) {
  const t = useTranslations("dashboard");
  const [copied, setCopied] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");

  async function copyStatusLink() {
    // Dashboard is locale-unprefixed today — default share locale to en (RESEARCH A5 / D-14a)
    const locale = "en";
    const url = `${window.location.origin}/${locale}/status?reportId=${encodeURIComponent(reportId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setLiveMessage(t("statusLinkCopied"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setLiveMessage("");
    }
  }

  return (
    <div className={embedded ? "space-y-2" : "mt-3 max-w-md space-y-2"}>
      <Button
        type="button"
        variant="outline"
        className={embedded ? "min-h-11 w-full gap-2" : "min-h-11 gap-2"}
        aria-label={t("copyStatusLink")}
        onClick={copyStatusLink}
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-600" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
        {t("copyStatusLink")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("statusLinkRecoveryHint")}</p>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveMessage}
      </div>
    </div>
  );
}
