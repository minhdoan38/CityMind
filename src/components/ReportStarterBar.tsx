"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";

const CATEGORIES = [
  "pothole",
  "flooding",
  "waste",
  "streetlight",
  "obstruction",
  "other",
] as const;

const CATEGORY_MESSAGE_KEYS = {
  pothole: "categoryPothole",
  flooding: "categoryFlooding",
  waste: "categoryWaste",
  streetlight: "categoryStreetlight",
  obstruction: "categoryObstruction",
  other: "categoryOther",
} as const;

type CategoryKey = (typeof CATEGORIES)[number];

export default function ReportStarterBar() {
  const t = useTranslations("public");
  const [category, setCategory] = useState<CategoryKey | "">("");
  const [location, setLocation] = useState("");

  const reportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (location.trim()) params.set("location", location.trim());
    const qs = params.toString();
    return qs ? `/report?${qs}` : "/report";
  }, [category, location]);

  return (
    <div className="surface-card-elevated rounded-2xl p-5 sm:p-6">
      <p className="text-sm font-medium text-foreground">{t("floatingBarLabel")}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="starter-category" className="text-sm text-muted-foreground">
            {t("floatingCategory")}
          </Label>
          <Select
            value={category || undefined}
            onValueChange={(value) => setCategory(value as CategoryKey)}
          >
            <SelectTrigger id="starter-category" className="min-h-11 w-full">
              <SelectValue placeholder={t("floatingCategoryPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((key) => (
                <SelectItem key={key} value={key}>
                  {t(CATEGORY_MESSAGE_KEYS[key])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="starter-location" className="text-sm text-muted-foreground">
            {t("floatingLocation")}
          </Label>
          <Input
            id="starter-location"
            type="text"
            className="min-h-11"
            placeholder={t("floatingLocationPlaceholder")}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </div>

        <Button asChild className="min-h-11 w-full font-semibold sm:w-auto">
          <Link href={reportHref}>{t("floatingSubmit")}</Link>
        </Button>
      </div>
    </div>
  );
}
