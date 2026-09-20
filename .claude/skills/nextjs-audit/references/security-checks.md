# Security Checks — Next.js App Router

Work through each section. Skip checks that don't apply to the project's stack (e.g., skip Supabase RLS checks if the project uses Prisma without Supabase).

## 1. Environment Variables & Secrets

**Why it matters:** Any variable prefixed with `NEXT_PUBLIC_` is shipped to the browser. Secrets there are visible to every user.

Check for:
- [ ] API keys, database URLs, auth secrets, or tokens prefixed with `NEXT_PUBLIC_`
- [ ] `.env` files committed to git (check `.gitignore` for `.env*` patterns)
- [ ] Hardcoded secrets in source files — API keys, connection strings, JWTs as string literals. Common patterns: `sk-live-`, `sk_live_`, `ghp_`, `gho_`, `glpat-`, `xoxb-`, `xoxp-`, `mongodb+srv://user:pass@`, `postgres://user:pass@`, `mysql://user:pass@`
- [ ] `next.config.js` exposing secrets through `env` or `publicRuntimeConfig`

**How to check:**
```bash
grep -rn "NEXT_PUBLIC_" --include="*.env*" . 
grep -rn "NEXT_PUBLIC_" --include="*.ts" --include="*.tsx" --include="*.js" .
```

Review each `NEXT_PUBLIC_` variable — is it truly safe to be public? Supabase `anon` keys are designed to be public. Stripe `publishable` keys are public. But anything with "secret", "private", "service_role", "admin" in its name should never be public.

## 2. Server-Only Code Boundary

**Why it matters:** In the App Router, it's easy to accidentally import a server-side module (containing secrets, database clients, or internal logic) into a Client Component. When this happens, the code — and any secrets it references — can end up in the browser bundle. The `server-only` package exists to prevent this: importing it in a module causes a build error if that module is ever included in a client bundle.

Check for:
- [ ] The `server-only` package is installed as a dependency
- [ ] Files that create database clients (Supabase `service_role`, Prisma, Drizzle), access secrets, or contain sensitive business logic import `"server-only"` at the top
- [ ] `lib/` or `server/` directories with server-only code have `import "server-only"` in their modules

**What to flag:**
- `server-only` not installed at all → 🟡 Warning
- Server utility files that access secrets or database without `import "server-only"` → 🟡 Warning
- A module that creates a Supabase `service_role` client without `import "server-only"` → 🔴 Critical (this client bypasses RLS and could leak into the browser)

## 3. Server Actions

**Why it matters:** Server Actions are public HTTP endpoints. Any user can call them with any payload. They must validate and authorize independently — never trust that the client sent valid data or that the caller is who you expect.

For each file containing `"use server"`:
- [ ] All inputs are validated (zod, valibot, or manual validation). Form data and function arguments must be parsed and validated — `formData.get('email')` without validation is a vulnerability.
- [ ] Authentication is checked inside the action. The action must verify the user's session/token — don't assume only authenticated users can reach it.
- [ ] Authorization is checked. Being authenticated isn't enough — verify the user has permission for this specific operation (e.g., can they edit THIS resource?).
- [ ] Database queries use parameterized inputs. String interpolation into SQL or Supabase filters is an injection vector.
- [ ] Error messages don't leak internal details (stack traces, database schema, file paths).
- [ ] Rate limiting exists for sensitive operations (login, signup, password reset, payment).

**Common anti-patterns:**
```typescript
// BAD: No validation, no auth check
"use server"
export async function deleteUser(userId: string) {
  await db.user.delete({ where: { id: userId } })
}

// GOOD: Validates, authenticates, authorizes
"use server"
export async function deleteUser(userId: string) {
  const parsed = z.string().uuid().parse(userId)
  const session = await getSession()
  if (!session) throw new Error("Unauthorized")
  if (session.user.role !== "admin") throw new Error("Forbidden")
  await db.user.delete({ where: { id: parsed } })
}
```

## 4. Route Handler Security

**Why it matters:** Route Handlers (`app/api/.../route.ts`) are also public HTTP endpoints. They face the same validation and auth requirements as Server Actions, plus additional concerns around CORS and HTTP method handling.

For each Route Handler:
- [ ] Authentication and authorization are checked (same rules as Server Actions)
- [ ] Input validation exists for query params, request body, and path params
- [ ] Only the expected HTTP methods are exported (`GET`, `POST`, etc.). Unexported methods return 405 automatically, but if a handler exports `GET` when it should only be `POST`, that's a vulnerability.
- [ ] Rate limiting exists for public-facing endpoints (auth, webhooks, file uploads)

### CORS
- [ ] If the Route Handler is called from a different origin (e.g., a mobile app, external frontend), CORS headers are set explicitly and restrictively — not `Access-Control-Allow-Origin: *` on endpoints that return user data
- [ ] Preflight `OPTIONS` requests are handled when CORS is needed
- [ ] State-changing endpoints (`POST`, `PUT`, `DELETE`) validate the `Origin` header or use CSRF tokens

**What to flag:**
- Route Handler with no auth check that exposes user data → 🔴 Critical
- `Access-Control-Allow-Origin: *` on an endpoint that returns or modifies user data → 🔴 Critical
- Route Handler without input validation → 🟡 Warning
- Missing rate limiting on auth or webhook endpoints → 🟡 Warning

## 5. Supabase / Database Security

Only check this section if the project uses Supabase.

### RLS Policies
- [ ] Every table that stores user data has RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Every table with RLS enabled has at least one policy defined. RLS enabled without policies = **no one can access the data** (or worse, if using `service_role` key, it bypasses RLS entirely)
- [ ] Policies use `auth.uid()` to scope access to the authenticated user's data
- [ ] No policy uses `true` as the condition for `SELECT`, `UPDATE`, or `DELETE` on sensitive tables (this means anyone can read/modify everything)
- [ ] `INSERT` policies validate that users can only create records they own

### Supabase Storage
If the project uses Supabase Storage (look for `supabase.storage` calls):
- [ ] Storage buckets have appropriate access policies — public buckets should only contain truly public assets (logos, marketing images), not user uploads
- [ ] Private buckets have RLS policies that scope access to the owning user
- [ ] File upload endpoints validate file type and size before uploading
- [ ] Signed URLs are used for temporary access to private files, with reasonable expiration times

### Client vs Service Role
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the only Supabase key in client-side code
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (or `service_role`) is NEVER in client code or `NEXT_PUBLIC_` variables
- [ ] Server-side Supabase clients that use `service_role` are only in Server Actions, Route Handlers, or server-only utilities — and those files import `"server-only"`
- [ ] When using `service_role`, operations bypass RLS — verify each usage is intentional and safe

### Migration Files
If SQL migration files exist in the repo, read them and check:
- [ ] Tables created without `ENABLE ROW LEVEL SECURITY` (flag as warning — not all tables need RLS, but any table with user data should have it)
- [ ] Overly permissive policies (e.g., `USING (true)` on a table with personal data)
- [ ] Missing policies on tables that have RLS enabled (enabled but no policies = locked out or bypassed)

## 6. Authentication & Session Management

- [ ] Auth middleware exists and protects routes that require authentication
- [ ] Token/session validation happens server-side, not just in client-side route guards
- [ ] Session tokens are not stored in `localStorage` (vulnerable to XSS). `httpOnly` cookies are preferred.

**How to check for localStorage token storage:**
```bash
grep -rn "localStorage\.\(setItem\|getItem\).*\(token\|session\|jwt\|auth\|key\)" --include="*.ts" --include="*.tsx" --include="*.js" . | grep -v node_modules
```
- [ ] Logout actually invalidates the session server-side, not just clears client state
- [ ] Password reset / magic link tokens expire
- [ ] OAuth redirect URIs are restricted to expected domains

## 7. Data Exposure to Client

- [ ] Server Components don't pass **internal or sensitive fields** as props to Client Components. Passing database IDs, public profile info, and display data is normal and necessary. What should NOT be passed: `password_hash`, `internal_notes`, `is_admin`, `role` (when used for authorization decisions client-side), API tokens, or any field the user shouldn't see in browser DevTools.
- [ ] `console.log` statements in server code don't log sensitive data (they may appear in server logs)
- [ ] Error boundaries don't render raw error messages to users in production

## 8. XSS & Injection

- [ ] `dangerouslySetInnerHTML` is audited — the content must be sanitized (DOMPurify or equivalent). If the content comes from user input, this is 🔴 Critical.
- [ ] URL parameters are not directly rendered without sanitization
- [ ] Redirect URLs are validated (open redirect vulnerabilities: `redirect(userInput)` without checking the URL is on your domain)

**How to check for open redirects:**
```bash
grep -rn "redirect(" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v "from ['\"]next"
```
For each result, verify the redirect target is not built from user input (query params, form data, headers) without validation.

- [ ] No use of `eval()` or `new Function()` with dynamic input. These execute arbitrary code and are almost never necessary in a Next.js app.
- [ ] No template literal string interpolation into SQL queries. Even with ORMs, raw query methods (`prisma.$queryRawUnsafe`, `supabase.rpc` with string-built queries) must use parameterized inputs.

**How to check:**
```bash
grep -rn "eval(\|new Function(" --include="*.ts" --include="*.tsx" --include="*.js" . | grep -v node_modules
grep -rn '\$queryRawUnsafe\|\$executeRawUnsafe' --include="*.ts" --include="*.tsx" . | grep -v node_modules
grep -rn '`.*\${.*}.*`' --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -i "query\|sql\|where\|select\|insert\|update\|delete"
```

## 9. Dependency Security

```bash
# Check for known vulnerabilities — use the correct package manager
if [ -f "pnpm-lock.yaml" ]; then
  pnpm audit --prod 2>/dev/null
elif [ -f "yarn.lock" ]; then
  yarn audit --groups dependencies 2>/dev/null
else
  npm audit --production 2>/dev/null
fi
```

Flag critical and high severity vulnerabilities. Moderate/low can be mentioned as suggestions.
