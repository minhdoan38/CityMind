"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import ChatIntakePanel from "@/components/coach/ChatIntakePanel";
import ReportForm from "@/components/ReportForm";
import { Button } from "@/components/ui/button";

export default function ReportIntakeShell() {
  const t = useTranslations("public.intake");
  const [showClassicForm, setShowClassicForm] = useState(false);

  if (showClassicForm) {
    return (
      <div>
        <ReportForm />
        <Button
          type="button"
          variant="link"
          className="mt-4 min-h-11 px-0 text-sm"
          onClick={() => setShowClassicForm(false)}
        >
          {t("chatFirstLink")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <ChatIntakePanel />
      <Button
        type="button"
        variant="link"
        className="mt-4 min-h-11 px-0 text-sm"
        onClick={() => setShowClassicForm(true)}
      >
        {t("classicFormLink")}
      </Button>
    </div>
  );
}
