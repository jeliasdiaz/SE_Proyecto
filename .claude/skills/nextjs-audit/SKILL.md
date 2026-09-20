---
name: nextjs-audit
description: Audit Next.js (App Router) + React codebases for security vulnerabilities, maintainability issues, architectural anti-patterns, and performance problems. Use this skill whenever the user asks to audit, review, analyze, or check a Next.js project's code quality — including requests like "review my code", "find security issues", "check my project", "audit this repo", "is my code production-ready", "find bugs", or any mention of code review for a Next.js or React project. Also trigger when the user mentions concerns about exposed env vars, Server Actions security, Supabase RLS policies, component separation, bundle size, or general code health in a Next.js context. This skill produces a structured, severity-ranked audit report with actionable fixes — not vague suggestions.
---

# Next.js Codebase Auditor

You are performing a phased, systematic audit of a Next.js App Router codebase. The audit prioritizes findings in this order: **Security → Maintainability → Architecture/Patterns → Performance**.

The goal is to produce an audit that a developer can immediately act on — every finding must include the file, the problem, why it matters, and how to fix it.

## Phase 1: Reconnaissance

Before reading any source files, map the project structure. This tells you what you're dealing with and where to focus.

Run this in the project root:

```bash
# Detect if project uses src/ directory
[ -d "./src/app" ] && echo "App root: src/app" || echo "App root: app"

# Project shape — count total files first
TOTAL_FILES=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" ! -path "*/.next/*" ! -path "*/dist/*" | wc -l)
echo "Total source files: $TOTAL_FILES"

# List all source files including .sql and .env
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.sql" -o -name "*.env*" \) \
  ! -path "*/node_modules/*" ! -path "*/.next/*" ! -path "*/dist/*" | head -300

# Package dependencies (attack surface) — reliable JSON parsing via Node
echo "=== dependencies ==="
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.dependencies||{}, null, 2))"
echo "=== devDependencies ==="
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.devDependencies||{}, null, 2))"

# Detect package manager
echo "=== Package manager ==="
[ -f "pnpm-lock.yaml" ] && echo "pnpm" || { [ -f "yarn.lock" ] && echo "yarn" || echo "npm"; }

# Environment files (may contain patterns, never log values)
ls -la .env* 2>/dev/null

# Check if .env is gitignored
echo "=== .env in .gitignore ==="
grep -n "\.env" .gitignore 2>/dev/null || echo "WARNING: No .env pattern found in .gitignore"

# Check for SQL migration files
find . -type f -name "*.sql" ! -path "*/node_modules/*" | head -50

# Next.js config
cat next.config.* 2>/dev/null | head -60

# TypeScript config (strictness)
cat tsconfig.json 2>/dev/null | head -40
```

### Large Project Gate

If the project has **more than 150 source files**, do not attempt to audit everything in one pass. Instead:

1. Run all security greps across the full codebase (security has no scope limit)
2. For maintainability/architecture/performance, focus on:
   - All files in `app/` (or `src/app/`) — pages, layouts, route handlers
   - All files containing `"use server"`
   - The top 20 largest `.tsx` files by line count
   - All files in `lib/` or `server/` directories
3. Note in the report that the audit was scoped and which directories were covered

### Mental Map

From the reconnaissance output, answer these questions before proceeding:
- What is the app root? (`app/` or `src/app/`?)
- How many route segments exist?
- Is there a `middleware.ts` (or `src/middleware.ts`)?
- Are there Server Actions (`"use server"`)?
- Are there migration SQL files (Supabase/Prisma/Drizzle)?
- What auth library is used (next-auth, clerk, supabase-auth, custom)?
- What data layer exists (Supabase, Prisma, Drizzle, raw fetch)?
- Is TypeScript strict mode enabled?

This map determines which checks from the reference files apply. Skip checks that are irrelevant to the project's stack.

## Phase 2: Security Audit

Security is the highest priority. A single vulnerability here can compromise the entire application and its users.

Read the security checklist: `references/security-checks.md`

Work through every applicable check in that file. For each file that matches a security-relevant pattern, read it and evaluate against the checklist.

**Critical patterns to grep for early:**

```bash
# Exposed secrets — broad pattern matching
grep -rn "NEXT_PUBLIC_.*SECRET\|NEXT_PUBLIC_.*KEY\|NEXT_PUBLIC_.*PASSWORD\|NEXT_PUBLIC_.*TOKEN\|NEXT_PUBLIC_.*SERVICE_ROLE\|NEXT_PUBLIC_.*PRIVATE\|NEXT_PUBLIC_.*ADMIN" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.env*" .

# Hardcoded secrets in source (API keys, connection strings)
grep -rn "sk-live-\|sk_live_\|sk-test-\|ghp_\|gho_\|glpat-\|xoxb-\|xoxp-\|mongodb+srv://\|postgres://.*:.*@\|mysql://.*:.*@" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . | grep -v node_modules

# Server Actions — find them and cross-reference with validation
echo "=== Server Action files ==="
grep -rln '"use server"' --include="*.ts" --include="*.tsx" . | grep -v node_modules
echo "=== Server Action files WITHOUT zod/valibot/yup imports ==="
grep -rln '"use server"' --include="*.ts" --include="*.tsx" . | grep -v node_modules | while IFS= read -r f; do
  grep -qE "from ['\"]zod|from ['\"]valibot|from ['\"]yup|from ['\"]joi" "$f" || echo "  NO VALIDATION: $f"
done

# Direct database queries in client-reachable code
grep -rn "supabase\.\|prisma\.\|db\." --include="*.ts" --include="*.tsx" . | grep -v node_modules

# Dangerous patterns — XSS, injection, eval
grep -rn "dangerouslySetInnerHTML\|eval(\|new Function(" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . | grep -v node_modules

# SQL files for RLS
find . -name "*.sql" ! -path "*/node_modules/*" -exec grep -l "CREATE TABLE\|CREATE POLICY\|ALTER TABLE.*ENABLE ROW LEVEL SECURITY" {} \;

# Check if server-only package is installed
grep -r "server-only" package.json 2>/dev/null
```

## Phase 3: Maintainability Audit

After security, focus on code that will become a burden over time. The core question is: **does each file/module have a single, clear responsibility?**

Read the maintainability checklist: `references/maintainability-checks.md`

**Key patterns to identify:**

```bash
# Large files (potential god components)
find . -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" ! -path "*/.next/*" -exec wc -l {} + | sort -rn | head -20

# TypeScript escape hatches
echo "=== any usage ==="
grep -rn ": any\|as any\|<any>" --include="*.ts" --include="*.tsx" . | grep -v node_modules | wc -l
echo "=== ts-ignore / ts-expect-error ==="
grep -rn "@ts-ignore\|@ts-expect-error" --include="*.ts" --include="*.tsx" . | grep -v node_modules | wc -l

# Test coverage presence
echo "=== Test files ==="
find . -type f \( -name "*.test.*" -o -name "*.spec.*" \) ! -path "*/node_modules/*" | head -20
echo "=== Test config ==="
ls jest.config.* vitest.config.* playwright.config.* cypress.config.* 2>/dev/null
```

For each large or complex file, assess whether it mixes data fetching, state management, business logic, and presentation. The fix is not "make it shorter" — it's "give each responsibility a clear home."

## Phase 4: Architecture & Patterns Audit

Check that the project uses Next.js App Router patterns correctly. Misuse here causes subtle bugs, poor UX, and unnecessary complexity.

Read the architecture checklist: `references/architecture-checks.md`

**Key patterns:**

```bash
# Client components that could be server components
grep -rn '"use client"' --include="*.tsx" --include="*.ts" . | grep -v node_modules

# Check for proper loading/error boundaries (handle both app/ and src/app/)
find . \( -path "*/app/*" \) \( -name "loading.tsx" -o -name "error.tsx" -o -name "not-found.tsx" \) ! -path "*/node_modules/*"

# Metadata exports in pages and layouts
grep -rn "export.*metadata\|generateMetadata" --include="*.tsx" --include="*.ts" . | grep -v node_modules | grep -E "(page|layout)\."

# Route handlers
find . \( -path "*/app/*" \) \( -name "route.ts" -o -name "route.js" \) ! -path "*/node_modules/*"

# Parallel routes (directories starting with @)
find . -type d -name "@*" ! -path "*/node_modules/*"

# Intercepting routes (directories with (.) (..) (...) prefix)
find . -type d ! -path "*/node_modules/*" | grep -E "\(\.\)"

# Middleware
cat middleware.ts 2>/dev/null || cat src/middleware.ts 2>/dev/null
```

## Phase 5: Performance Audit

Performance issues last. They matter, but a secure and maintainable codebase is the foundation.

Read the performance checklist: `references/performance-checks.md`

**Key patterns:**

```bash
# Images not using next/image
grep -rn '<img ' --include="*.tsx" --include="*.jsx" . | grep -v node_modules

# Large client-side imports
grep -rn "from ['\"]lodash['\"]" --include="*.ts" --include="*.tsx" . | grep -v node_modules

# Third-party scripts not using next/script
grep -rn '<script ' --include="*.tsx" --include="*.jsx" . | grep -v node_modules

# Missing Suspense boundaries
grep -rn "Suspense" --include="*.tsx" . | grep -v node_modules

# Bundle analyzer presence
grep -r "@next/bundle-analyzer" package.json 2>/dev/null

# Web Vitals reporting
grep -rn "reportWebVitals\|web-vitals\|useReportWebVitals" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

## Phase 6: Report Generation

After completing all phases, produce the audit report. Use this exact structure:

```markdown
# 🔍 Next.js Codebase Audit Report

**Project:** [name from package.json]
**Date:** [current date]
**Scope:** [files scanned / total files — note if scoped due to project size]

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | X |
| 🟡 Warning | X |
| 🔵 Suggestion | X |

---

## 🔴 Critical Findings

### [C-001] [Short title]
- **File:** `path/to/file.tsx:LINE`
- **Category:** Security | Maintainability | Architecture | Performance
- **Problem:** [What is wrong — be specific]
- **Impact:** [Why this matters — what can go wrong]
- **Fix:** [Exact steps or code to fix it]

---

## 🟡 Warnings

### [W-001] [Short title]
[same structure as critical]

---

## 🔵 Suggestions

### [S-001] [Short title]
[same structure as critical]

---

## ✅ What's Done Well

[List 3-5 things the project does correctly. This provides balance and acknowledges good practices.]

---

## 🗺️ Prioritized Next Steps

Based on this audit, here is the recommended order of action:

1. **[Immediately — before next deploy]:** [List critical finding IDs and one-line summary]
2. **[This week]:** [List high-priority warning IDs]
3. **[This sprint/month]:** [List remaining warnings]
4. **[Backlog]:** [List suggestions worth tracking]

Each step references the finding ID (C-001, W-003, etc.) so the developer can jump to the details.
```

**Severity classification:**

- **🔴 Critical:** Security vulnerabilities, data exposure risks, broken auth patterns, missing input validation on Server Actions. These must be fixed before any production deploy.
- **🟡 Warning:** Maintainability problems that will compound (god components, mixed concerns, missing error boundaries), incorrect Next.js patterns that cause subtle bugs (wrong use of `"use client"`, improper caching).
- **🔵 Suggestion:** Performance optimizations, code style improvements, patterns that would improve developer experience but aren't breaking anything.

**Rules for findings:**
- Every finding MUST have a specific file path. "The project has poor separation of concerns" is not a finding — "`app/dashboard/page.tsx` mixes API calls, state management, and rendering in a 400-line component" is.
- Every fix MUST be actionable. "Consider refactoring" is not actionable — "Extract the data fetching into `lib/dashboard/queries.ts` and the business logic into `lib/dashboard/utils.ts`" is.
- Do not fabricate findings. If a phase reveals no issues, say so. An honest "no critical findings" is infinitely more valuable than invented problems.
- Do not duplicate findings across categories. If a Server Action issue is flagged under Security, do not flag the same issue again under Maintainability. Each finding appears once under its most relevant category.
- Include the "What's Done Well" section. Audits that only criticize are demoralizing and less likely to be acted on.
- Always include the "Prioritized Next Steps" section. This is what turns a report into an action plan.
