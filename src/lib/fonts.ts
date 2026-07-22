import { Roboto } from "next/font/google";

/** Roboto — Android / general UI fallback in the stack. */
export const roboto = Roboto({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

/**
 * Google Sans family roles (loaded via globals.css @import from Google Fonts):
 * - Google Sans — brand headings & product titles (replaces proprietary Product Sans)
 * - Google Sans Text — body & dense UI copy
 * - Google Sans Flex — expressive display (hero)
 * - Google Sans Code — monospace (IDs, timestamps, code)
 */
