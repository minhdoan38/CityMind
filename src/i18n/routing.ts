import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "vi"],
  defaultLocale: "en",
  localePrefix: "always",
  // D-14: Accept-Language negotiation via next-intl middleware (default true)
  localeDetection: true,
});
