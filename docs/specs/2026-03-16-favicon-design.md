# Favicon Design Spec

**Issue:** #15 — Add XOX favicon
**Date:** 2026-03-16

## Summary

Replace the default Next.js favicon with a custom "xox"
text mark favicon. Lowercase bold white text on the app's
dark background (`#0a0a0a`).

## Visual Design

- **Text:** `xox` in lowercase
- **Font:** System sans-serif, weight 800 (extra bold)
- **Letter spacing:** Tight (-2px equivalent)
- **Foreground:** `#ffffff`
- **Background:** `#0a0a0a` (matches app theme)
- **Shape:** Rounded rectangle background

## Source File

`src/app/favicon.svg` — SVG with a dark rounded-rect
background and white "xox" text. The text is converted
to `<path>` elements (outlined) so rasterization does
not depend on any installed font.

## Generated Assets

| File | Size | Format |
|------|------|--------|
| `src/app/favicon.ico` | 16x16 + 32x32 | Multi-size ICO |
| `src/app/apple-touch-icon.png` | 180x180 | PNG |

Both files are committed to the repo. The ICO overwrites
the existing default Next.js favicon at `src/app/favicon.ico`.

## Build Script

`scripts/generate-favicon.sh` — Uses ImageMagick to
render the SVG source to target sizes.

Steps:
1. Render SVG to 16x16 and 32x32 PNGs
2. Combine into multi-size `favicon.ico`
3. Render SVG to 180x180 `apple-touch-icon.png`

Run once; output is committed. Re-run after editing the
SVG source.

## Layout Change

Add `icons` to the metadata export in
`src/app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  title: "XOX",
  description: "An xox-style drum sequencer",
  icons: {
    apple: "/apple-touch-icon.png",
  },
};
```

Next.js App Router automatically picks up `favicon.ico`
from `src/app/`, so only the `apple` entry needs to be
added explicitly.

## What Does Not Change

- No new runtime dependencies
- No changes to the build pipeline
- Static export to Cloudflare Pages works as before
