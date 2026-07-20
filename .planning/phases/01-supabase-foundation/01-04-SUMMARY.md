# Summary: Phase 1 Plan 04 — Public Home & Localization (Track B2)

Created the semantic unauthenticated public Home page and configured route-preserving bilingual translation support.

## What Was Built

1. **Moved Officer Dashboard** (`frontend/src/app/dashboard/page.tsx`):
   - Moved the existing dashboard route from `/` to `/dashboard/page.tsx` to accommodate the public Home route.

2. **Public Home Page** (`frontend/src/app/page.tsx`):
   - Created the semantic unauthenticated layout including Header, Main, and Footer.
   - Restructured the primary layout to use the Source Sans 3 typography tokens.
   - Built a high-contrast landing presentation with the CityMind title/subtitle and a primary CTA linking to `/report`.

3. **next-intl Translation Catalogs** (`frontend/messages/`):
   - Created English (`en.json`) and Vietnamese (`vi.json`) files with identical keys for all Phase 1 components.

4. **Localization Configurations** (`frontend/src/i18n/`):
   - Configured `request.ts` to read locale from user preferences using cookies.
   - Set up `routing.ts` to disable URL path prefixes (`localePrefix: 'never'`), ensuring clean, unprefixed routes.
   - Wrapped `next.config.ts` with `withNextIntl` to resolve catalog imports.

5. **Locale Preference Service & Switcher Component** (`frontend/src/services/locale.ts`, `frontend/src/components/LocaleSwitcher.tsx`):
   - Built a Client-Side `LocaleSwitcher` dropdown dropdown-menu control.
   - Implemented cookie-set Server Actions for setting preferences without losing active paths.

6. **Secured Routes in Proxy** (`frontend/src/proxy.ts`):
   - Configured `proxy.ts` to keep the public `/` path unauthenticated and only restrict `/reports/*` (and dashboard paths).

## Verification & Testing

- Developed and passed `tests/public-shell.test.mjs` validating translation key parity and resource existence.
- Verified that all route targets compile successfully via `npm run lint` and `npm run build`.
