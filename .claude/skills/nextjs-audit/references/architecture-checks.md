# Architecture & Patterns Checks — Next.js App Router

These checks verify that the project uses Next.js App Router patterns correctly. Getting these wrong doesn't always cause visible bugs — but it causes unnecessary client-side JavaScript, poor loading UX, stale data, and patterns that fight the framework instead of working with it.

## 1. Server vs Client Component Boundary

**The principle:** Components are Server Components by default in the App Router. They run on the server, have zero client JS cost, and can directly access databases, file systems, and secrets. Add `"use client"` only when you need interactivity (event handlers, hooks like `useState`, `useEffect`, browser APIs).

**What to check:**
- [ ] Components marked `"use client"` actually need it — look for `useState`, `useEffect`, `onClick`, `onChange`, or browser APIs. If a component has `"use client"` but no hooks or event handlers, it should be a Server Component.
- [ ] The boundary is as deep as possible. A `"use client"` at the page level means EVERYTHING in that page is client-rendered. Instead, the page should be a Server Component that imports small `"use client"` interactive pieces.
- [ ] Data fetching happens in Server Components, not in Client Components using `useEffect` + `fetch`. This is the most common anti-pattern in Next.js apps migrating from Pages Router.

Note: Server Components importing Client Components is the **correct and expected pattern** — a Server Component page that imports `<InteractiveForm />` (client) is exactly how the boundary should work. Do not flag this as an issue.

**What to flag:**
- `"use client"` on a page or layout component → 🟡 Warning
- `"use client"` component with no hooks or event handlers → 🔵 Suggestion
- `useEffect` + `fetch` pattern for data that could be fetched in a Server Component → 🟡 Warning
- Passing serializable data from Server → Client is fine, but passing functions or complex objects that can't serialize will cause runtime errors → 🔴 Critical if detected

## 2. Route Structure & Conventions

**File-based routing checks:**
- [ ] `layout.tsx` exists at the app root
- [ ] Layouts don't re-render unnecessarily (they shouldn't use `"use client"` unless they need client-side state for navigation, theme, etc.)
- [ ] `loading.tsx` exists for routes that fetch data (provides instant loading UI instead of blank screen)
- [ ] `error.tsx` exists at minimum at the app root (catches unhandled errors gracefully). Remember that `error.tsx` must be a Client Component (`"use client"`) — this is a Next.js requirement.
- [ ] `not-found.tsx` exists at the app root

**What to flag:**
- No `error.tsx` anywhere in the app → 🟡 Warning
- No `loading.tsx` for routes that do async data fetching → 🔵 Suggestion
- Route groups `(groupName)` used inconsistently or confusingly → 🔵 Suggestion

## 3. Metadata & SEO

**Why it matters:** Search engines and social media platforms rely on metadata to index and display pages. Next.js App Router has first-class metadata support — not using it is a missed opportunity that's trivial to fix.

**What to check:**
- [ ] The root `layout.tsx` exports a `metadata` object with at least `title` and `description`
- [ ] Individual pages export `metadata` or `generateMetadata` for page-specific titles and descriptions
- [ ] Dynamic pages (e.g., `/blog/[slug]`) use `generateMetadata` to set metadata based on the content
- [ ] Open Graph and Twitter card metadata exist on key pages (homepage, blog posts, product pages)

**What to flag:**
- Root layout has no `metadata` export at all → 🟡 Warning
- Pages have no metadata, relying entirely on the root layout default → 🔵 Suggestion
- Dynamic pages with hardcoded metadata instead of `generateMetadata` → 🔵 Suggestion

## 4. Data Fetching Patterns

**Server-side fetching:**

**Important version difference:** In Next.js 14 and earlier, `fetch()` in Server Components caches by default (`force-cache`). In **Next.js 15+**, `fetch()` does NOT cache by default — it behaves like `no-store`. Check the project's Next.js version in `package.json` before flagging caching issues.

- [ ] `fetch()` in Server Components uses appropriate caching strategy. For Next.js 14: `{ cache: 'force-cache' }` (default) for static, `{ cache: 'no-store' }` for dynamic. For Next.js 15+: `{ cache: 'force-cache' }` must be explicit for static data, `{ next: { revalidate: N } }` for ISR.
- [ ] When using ORMs (Prisma, Drizzle) in Server Components, there's no automatic `fetch`-level caching. Use React's `cache()` function for request-level deduplication, or Next.js `unstable_cache` / the `"use cache"` directive (Next.js 15+) for cross-request caching.
- [ ] Parallel data fetching uses `Promise.all()` instead of sequential awaits when queries are independent

**What to flag:**
- Multiple sequential `await` calls that could be parallel → 🔵 Suggestion
- `fetch()` without explicit cache strategy in production-facing code → 🔵 Suggestion
- `useEffect` + `fetch` in a component that could be a Server Component → 🟡 Warning (this is both an architecture and performance issue)

## 5. Server Actions vs Route Handlers

**When to use what:**
- Server Actions (`"use server"` functions): form submissions, data mutations, simple RPC-style calls from Client Components
- Route Handlers (`app/api/.../route.ts`): webhooks, third-party API integrations, endpoints consumed by external clients, long-running operations

**What to flag:**
- Route Handlers doing simple CRUD that should be Server Actions → 🔵 Suggestion
- Server Actions handling webhook-style logic (they can't set custom response headers, handle non-form payloads easily) → 🔵 Suggestion
- Route Handlers without proper HTTP method handling (missing `GET`/`POST` function exports, no method validation) → 🟡 Warning

## 6. Middleware

If `middleware.ts` (or `src/middleware.ts`) exists:
- [ ] It runs on the Edge Runtime (no Node.js-only APIs like `fs`, `crypto` with certain methods)
- [ ] It's focused on cross-cutting concerns: auth redirects, locale detection, A/B testing headers
- [ ] It doesn't do heavy computation or database queries (middleware runs on every matched request)
- [ ] The matcher config is specific, not matching everything (`matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']` is a common starting pattern)

**What to flag:**
- Middleware doing database queries → 🟡 Warning
- Middleware without a `matcher` config (runs on every request including static assets) → 🟡 Warning
- Auth logic in middleware that doesn't cover all protected routes → 🔴 Critical

## 7. Parallel & Intercepting Routes

Only check this section if the project uses parallel routes (`@folder`) or intercepting routes (`(.)folder`, `(..)folder`, `(...)folder` naming conventions).

**How to detect them:**
```bash
# Parallel routes — directories starting with @
find . -type d -name "@*" ! -path "*/node_modules/*"

# Intercepting routes — directories with (.) (..) (...) prefix
find . -type d ! -path "*/node_modules/*" -exec sh -c 'case "$(basename "$1")" in \(.*)* ) echo "$1";; esac' _ {} \;
```

These are advanced App Router features that enable complex UI patterns (modals, split views). When used correctly, they're powerful. When used incorrectly, they create confusing navigation and hydration bugs.

**What to check:**
- [ ] Each parallel route slot (`@folder`) has a `default.tsx` file — without it, Next.js renders a 404 for unmatched parallel segments during soft navigation
- [ ] Intercepting routes have a matching "real" route they intercept — an intercept without a real destination breaks hard navigation (direct URL access, page refresh)
- [ ] The use case justifies the complexity. If a modal can be implemented with client-side state and a portal, parallel/intercepting routes may be over-engineering.

**What to flag:**
- Parallel route slot missing `default.tsx` → 🟡 Warning (causes 404 on soft navigation)
- Intercepting route without corresponding real route → 🔴 Critical (broken hard navigation)
- Only as 🔵 Suggestion if the pattern adds unnecessary complexity

## 8. Project Structure

There's no single "correct" structure, but there are anti-patterns:

- [ ] Feature code isn't scattered — related components, hooks, types, and utils for a feature should be colocated, not spread across top-level `/components`, `/hooks`, `/types`, `/utils` folders
- [ ] `lib/` or `server/` exists for server-only code, clearly separated from client-importable code
- [ ] No circular imports between features

**What to flag:**
- Only as 🔵 Suggestion, since project structure is preference-heavy. Flag clear problems (circular dependencies, deeply nested shared components), not style differences.
