# Performance Checks — Next.js App Router

Performance is the lowest priority in this audit — fix security holes and maintainability issues first. But these checks catch the low-hanging fruit that can meaningfully impact user experience.

## 1. Bundle Size

**Why it matters:** Every KB of JavaScript the browser downloads must be parsed and executed before the page becomes interactive. Large bundles directly increase Time to Interactive.

**What to check:**
- [ ] No barrel imports from large libraries: `import { debounce } from 'lodash'` imports ALL of lodash (~70KB). Use `import debounce from 'lodash/debounce'` or switch to `lodash-es` with tree-shaking.
- [ ] Heavy libraries (moment.js, lodash full, date-fns full) aren't imported in Client Components when lighter alternatives exist
- [ ] Icons imported individually, not as full icon packs: `import { IconHome } from '@tabler/icons-react'` is fine, `import * as Icons from '@tabler/icons-react'` is not
- [ ] Dynamic imports (`next/dynamic` or `React.lazy`) used for heavy components that aren't needed on initial render (modals, rich text editors, chart libraries)

**What to flag:**
- Full lodash/moment.js import in client bundle → 🟡 Warning
- Entire icon library imported → 🟡 Warning
- Heavy component (chart, editor, map) not dynamically imported → 🔵 Suggestion

### Bundle Analyzer

- [ ] Check if `@next/bundle-analyzer` is installed. This tool lets developers visually inspect what's in their client and server bundles — it's the single most useful tool for diagnosing bundle size issues.

**What to flag:**
- `@next/bundle-analyzer` not in devDependencies → 🔵 Suggestion ("Install `@next/bundle-analyzer` and run `ANALYZE=true next build` to visualize your bundle. This helps catch unexpected large dependencies before they reach production.")

## 2. Images

- [ ] Images use `next/image` component instead of raw `<img>` tags. `next/image` provides automatic optimization, lazy loading, and proper sizing.
- [ ] Images have explicit `width` and `height` or use `fill` prop (prevents layout shift)
- [ ] Large hero/banner images have `priority` prop (tells Next.js to preload them)
- [ ] Images from external domains are listed in `next.config.js` `images.remotePatterns`

**What to flag:**
- `<img>` tags for content images → 🟡 Warning (accessibility and performance)
- `next/image` without dimensions → 🔵 Suggestion
- External images not in `remotePatterns` (will fail at runtime) → 🟡 Warning

## 3. Third-Party Scripts

**Why it matters:** Analytics, chat widgets, ad pixels, and tracking scripts are often loaded via raw `<script>` tags in the layout or head. This blocks rendering and delays First Contentful Paint. Next.js provides `next/script` with loading strategies that prevent this.

**What to check:**
- [ ] Third-party scripts use `next/script` instead of raw `<script>` tags
- [ ] Non-critical scripts (analytics, chat, tracking) use `strategy="lazyOnload"` or `strategy="afterInteractive"` — not `strategy="beforeInteractive"` (which blocks rendering like a raw `<script>`)
- [ ] Google Tag Manager, Google Analytics, Facebook Pixel, HotJar, Intercom, and similar services use `next/script` or their official Next.js integration packages

**What to flag:**
- Raw `<script>` tags for third-party services in layout or head → 🟡 Warning
- `next/script` with `strategy="beforeInteractive"` for non-essential scripts → 🔵 Suggestion
- Multiple tracking scripts without consolidated tag management (GTM) → 🔵 Suggestion

## 4. Rendering Strategy

- [ ] Static pages that don't need real-time data are actually static (no `{ cache: 'no-store' }` or `cookies()`/`headers()` calls that force dynamic rendering unnecessarily)
- [ ] Dynamic pages that should be cached use ISR (`revalidate`) instead of rendering on every request
- [ ] `generateStaticParams` is used for dynamic routes with a known set of params (blog posts, product pages)

**What to flag:**
- Pages forced dynamic without clear reason → 🔵 Suggestion
- High-traffic dynamic pages without any caching strategy → 🟡 Warning

## 5. Suspense & Streaming

- [ ] Async Server Components that do slow data fetching are wrapped in `<Suspense>` with a fallback (enables streaming — the shell renders immediately, slow content streams in)
- [ ] Multiple independent data requirements on a page use separate `<Suspense>` boundaries (one slow query shouldn't block the entire page)

**What to flag:**
- Page with 3+ independent data fetches without Suspense boundaries → 🔵 Suggestion
- Entire page blocked by a single slow query that could be streamed → 🔵 Suggestion

## 6. Client-Side Performance

- [ ] `useEffect` isn't doing work that could happen during render or in an event handler
- [ ] Lists render with stable `key` props (not array indices for lists that reorder)
- [ ] Heavy computations use `useMemo`/`useCallback` where they're passed to child components or used in dependency arrays (don't flag missing memo for simple cases — premature optimization is its own problem)
- [ ] No state updates in tight loops without batching

**What to flag:**
- Array index as `key` on a list that supports reordering/filtering → 🟡 Warning
- `useEffect` that runs on every render due to unstable dependencies (object/array literals in deps) → 🟡 Warning
- Only flag missing `useMemo`/`useCallback` when there's a clear performance impact, not as a blanket rule → 🔵 Suggestion at most

## 7. Fonts

- [ ] Custom fonts use `next/font` (automatic optimization, prevents FOUT/FOIT)
- [ ] Fonts aren't loaded via `<link>` tags in `<head>` or `@import` in CSS (blocks rendering)

**What to flag:**
- Google Fonts loaded via `<link>` instead of `next/font/google` → 🔵 Suggestion
- Multiple font families loaded (each adds weight) → 🔵 Suggestion

## 8. Web Vitals Monitoring

**Why it matters:** Without measurement, performance optimization is guesswork. Core Web Vitals (LCP, FID/INP, CLS) directly affect search ranking and user experience. Even basic monitoring surfaces regressions before users complain.

**What to check:**
- [ ] The project has some form of Web Vitals reporting — either the built-in `useReportWebVitals` hook (Next.js), a `web-vitals` library integration, or a third-party monitoring service (Vercel Analytics, Sentry, Datadog RUM)
- [ ] If using Vercel, check if `@vercel/analytics` or `@vercel/speed-insights` are installed

**What to flag:**
- No Web Vitals monitoring of any kind → 🔵 Suggestion ("Add `@vercel/speed-insights` or integrate the `web-vitals` library to track Core Web Vitals. Without measurement, you won't know if a deploy degrades performance until users complain.")
- This is always a 🔵 Suggestion, never higher — the app works fine without it, but it's a best practice worth adopting.
