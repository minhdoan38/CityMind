"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import ReportAnalyzingState from "@/components/ReportAnalyzingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import ReportLocationMiniMap from "@/components/ReportLocationMiniMap";
import { DEFAULT_MAX_EVIDENCE_BYTES } from "@/lib/evidence-limits";
import {
  EVIDENCE_FILE_ACCEPT,
  isAcceptedEvidenceClientFile,
} from "@/lib/evidence-input-types";

import {
  failedReasonFromStatus,
  writeReportFailedFlash,
  writeReportSuccessFlash,
} from "@/lib/report-outcome-flash";
const ANALYZE_STEP_MS = 1600;
const ANALYZE_DONE_MS = 480;

type AnalyzeStep = 0 | 1 | 2 | 3;

const reportSchema = z.object({
  description: z.string().min(5).max(3000),
  latitude: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const num = parseFloat(val);
        return !Number.isNaN(num) && num >= -90 && num <= 90;
      },
      { message: "Latitude must be between -90 and 90" },
    ),
  longitude: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const num = parseFloat(val);
        return !Number.isNaN(num) && num >= -180 && num <= 180;
      },
      { message: "Longitude must be between -180 and 180" },
    ),
  image: z
    .any()
    .optional()
    .refine((files) => {
      if (!files || files.length === 0) return true;
      return files[0].size <= DEFAULT_MAX_EVIDENCE_BYTES;
    }, "Max image size is 10MB.")
    .refine((files) => {
      if (!files || files.length === 0) return true;
      return isAcceptedEvidenceClientFile(files[0]);
    }, "Supported formats: JPEG, PNG, WebP, HEIC (iPhone), or TIFF."),
});

type ReportFormValues = z.infer<typeof reportSchema>;

export default function ReportForm() {
  const t = useTranslations("public");
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState<AnalyzeStep>(0);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      description: "",
      latitude: "",
      longitude: "",
      image: undefined,
    },
  });

  const { isSubmitting } = form.formState;
  const latitude = useWatch({ control: form.control, name: "latitude" }) ?? "";
  const longitude = useWatch({ control: form.control, name: "longitude" }) ?? "";

  useEffect(() => {
    if (!isAnalyzing || analyzeStep >= 2) return;

    const timer = window.setTimeout(() => {
      setAnalyzeStep((current) => (current < 2 ? ((current + 1) as AnalyzeStep) : current));
    }, ANALYZE_STEP_MS);

    return () => window.clearTimeout(timer);
  }, [isAnalyzing, analyzeStep]);

  function resetAnalyzing() {
    setIsAnalyzing(false);
    setAnalyzeStep(0);
  }

  function useMyLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue("latitude", position.coords.latitude.toFixed(6));
        form.setValue("longitude", position.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (reason) => {
        setLocationError(
          reason.code === reason.PERMISSION_DENIED
            ? "Location permission was denied. Enter coordinates manually."
            : "Could not get location. Enter coordinates manually.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function onSubmit(data: ReportFormValues) {
    flushSync(() => {
      setError("");
      setIsAnalyzing(true);
      setAnalyzeStep(0);
    });

    const formData = new FormData();
    formData.append("description", data.description);
    if (data.latitude) formData.append("latitude", data.latitude);
    if (data.longitude) formData.append("longitude", data.longitude);
    if (data.image?.[0]) {
      formData.append("image", data.image[0]);
    }

    try {
      const res = await fetch("/api/public/reports", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message =
          typeof body?.detail === "string" ? body.detail : t("formErrorNetwork");
        writeReportFailedFlash({
          message,
          reason: failedReasonFromStatus(res.status),
          status: res.status,
        });
        resetAnalyzing();
        router.push("/report/failed");
        return;
      }

      const body = await res.json();
      const reportId = body?.report_id;
      const accessToken = body?.access_token;

      if (!reportId || !accessToken) {
        writeReportFailedFlash({
          message: t("formErrorNetwork"),
          reason: "server",
        });
        resetAnalyzing();
        router.push("/report/failed");
        return;
      }

      writeReportSuccessFlash({
        reportId,
        accessToken,
        outcome: {
          service_step: body.service_step ?? "ai_review_pending",
          triage_status: body.triage_status ?? "pending",
          routing_destination: body.routing_destination ?? null,
          category: body.category ?? null,
          severity: body.severity ?? null,
          priority: body.priority ?? null,
          summary: body.summary ?? null,
          recommendation: body.recommendation ?? null,
          playbook_id: body.playbook_id ?? null,
          can_escalate: body.can_escalate ?? false,
          guidance_script: body.guidance_script ?? null,
          guidance_status: body.guidance_status ?? null,
          allowed_actions: body.allowed_actions ?? [],
          prohibited_actions: body.prohibited_actions ?? [],
        },
      });

      setAnalyzeStep(3);
      await new Promise((resolve) => window.setTimeout(resolve, ANALYZE_DONE_MS));
      router.push("/report/success");
    } catch {
      writeReportFailedFlash({
        message: t("formErrorNetwork"),
        reason: "network",
      });
      resetAnalyzing();
      router.push("/report/failed");
    }
  }

  if (isAnalyzing) {
    return (
      <div className="report-form-shell surface-card-elevated report-form-shell-analyzing">
        <ReportAnalyzingState step={analyzeStep} />
      </div>
    );
  }

  return (
    <div className="report-form-shell surface-card-elevated">
      <header className="report-form-header hero-rise">
        <h2 className="report-form-title font-heading text-balance">
          {t("reportPageTitle")}
        </h2>
        <p className="report-form-lead text-pretty">{t("reportPageLead")}</p>
        <p className="report-form-advisory">{t("heroAdvisory")}</p>
      </header>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, () => {
            setError(t("formErrorClient"));
          })}
          className="report-form-body hero-rise hero-rise-delay-1 space-y-5"
          noValidate
        >
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="report-form-label">{t("descriptionLabel")}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    maxLength={3000}
                    rows={5}
                    placeholder={t("descriptionPlaceholder")}
                    disabled={isSubmitting}
                    className="report-form-textarea min-h-32 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("imageLabel")}</FormLabel>
                <FormControl>
                  <Input
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    type="file"
                    accept={EVIDENCE_FILE_ACCEPT}
                    disabled={isSubmitting}
                    className="min-h-11 w-full text-sm"
                    onChange={(event) => field.onChange(event.target.files)}
                  />
                </FormControl>
                <FormDescription>{t("imageHelper")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="report-form-location space-y-4 border-t border-border pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="report-form-label">{t("locationLabel")}</p>
                <p className="report-form-helper">{t("locationHelper")}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={useMyLocation}
                disabled={locating || isSubmitting}
                className="min-h-11"
              >
                {locating ? t("gettingLocation") : t("useMyLocation")}
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("latitudeLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        placeholder="21.028500"
                        disabled={isSubmitting}
                        className="min-h-11 text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("longitudeLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        placeholder="105.854200"
                        disabled={isSubmitting}
                        className="min-h-11 text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <ReportLocationMiniMap
              latitude={latitude}
              longitude={longitude}
              onCoordsChange={(lat, lng) => {
                form.setValue("latitude", lat);
                form.setValue("longitude", lng);
              }}
              disabled={isSubmitting}
            />

            {locationError ? (
              <p role="alert" className="text-sm text-amber-700">
                {locationError}
              </p>
            ) : null}
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="submit"
            className="report-form-submit hero-cta min-h-12 w-full text-base font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("formAnalyzing") : t("submitReport")}
          </Button>
        </form>
      </Form>
    </div>
  );
}
