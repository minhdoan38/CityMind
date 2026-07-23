"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
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

const FLASH_KEY = "citymind:report-success";
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
] as const;

const ACCEPTED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

function isAcceptedImageFile(file: File): boolean {
  if (
    ACCEPTED_IMAGE_TYPES.includes(
      file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
    )
  ) {
    return true;
  }

  if (!file.type || file.type === "application/octet-stream") {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    return ACCEPTED_IMAGE_EXTENSIONS.has(ext);
  }

  return false;
}

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
      return isAcceptedImageFile(files[0]);
    }, "Only .jpg, .png and .webp formats are supported."),
});

type ReportFormValues = z.infer<typeof reportSchema>;

export default function ReportForm() {
  const t = useTranslations("public");
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");

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
    setError("");

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
        setError(
          typeof body?.detail === "string"
            ? body.detail
            : t("formErrorNetwork"),
        );
        return;
      }

      const body = await res.json();
      const reportId = body?.report_id;
      const accessToken = body?.access_token;

      // Soft A→B contract: prefer Plan 02-01 access_token; surface network copy if absent
      if (!reportId || !accessToken) {
        setError(t("formErrorNetwork"));
        return;
      }

      sessionStorage.setItem(
        FLASH_KEY,
        JSON.stringify({
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
        }),
      );

      router.push("/report/success");
    } catch {
      setError(t("formErrorNetwork"));
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {t("reportPageTitle")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("heroAdvisory")}</p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, () => {
            setError(t("formErrorClient"));
          })}
          className="mt-6 space-y-5"
          noValidate
        >
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("descriptionLabel")}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    maxLength={3000}
                    rows={4}
                    placeholder={t("descriptionPlaceholder")}
                    disabled={isSubmitting}
                    className="min-h-28 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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
                    accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
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

          <div className="space-y-4 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("locationLabel")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("locationHelper")}
                </p>
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
            className="min-h-11 w-full font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("formAnalyzing") : t("submitReport")}
          </Button>
        </form>
      </Form>
    </div>
  );
}
