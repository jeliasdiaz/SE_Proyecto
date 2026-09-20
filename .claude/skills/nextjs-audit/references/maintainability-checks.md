# Maintainability Checks — Next.js App Router

The core principle: **every file should have a single, clear responsibility.** A component that fetches data, manages state, contains business logic, AND renders UI is four responsibilities in one file. That's not a style preference — it's a maintenance cost multiplier. When you need to change the data fetching, you risk breaking the UI. When you refactor the UI, you might break the business logic.

**Deduplication note:** If a Server Action issue was already flagged under Security (missing validation, missing auth), do not flag it again here. Each finding appears once in the report under its most relevant category.

## 1. TypeScript Strictness

**Why it matters:** TypeScript's type system is only as strong as its configuration. A project with `strict: false` or widespread `any` usage loses most of the benefits of TypeScript — bugs that the compiler would catch slip through to runtime, and refactoring becomes guesswork.

Check `tsconfig.json`:
- [ ] `"strict": true` is enabled. If not, which strict flags are missing? (`strictNullChecks`, `noImplicitAny`, `strictFunctionTypes` are the most impactful)
- [ ] `noUncheckedIndexedAccess` is enabled (prevents assuming array/object access always returns a value)

Check source files for escape hatches:
- [ ] Count of `as any` / `: any` / `<any>` usages. A few are acceptable (third-party library gaps); dozens indicate type system avoidance.
- [ ] Count of `@ts-ignore` / `@ts-expect-error`. Each one is a suppressed warning — the code at that location has a known or suspected type issue that was silenced instead of fixed.

**What to flag:**
- `strict: false` or missing `strict` in tsconfig → 🟡 Warning
- More than 10 `any` usages across the project → 🟡 Warning (list the top offending files)
- More than 5 `@ts-ignore` without accompanying explanation comments → 🟡 Warning
- `@ts-ignore` preferred over `@ts-expect-error` → 🔵 Suggestion (`@ts-expect-error` is safer because it errors if the suppression becomes unnecessary)

## 2. Separation of Concerns

For each component file (especially those over 150 lines), check whether it mixes these layers:

| Layer | Belongs in | Signs of mixing |
|-------|-----------|----------------|
| Data fetching | Server Components, `lib/` query modules | `fetch()`, `supabase.from()`, `prisma.` inside a component that also renders UI |
| Business logic | `lib/` or `utils/` modules | Calculations, transformations, validation logic inline in components |
| State management | Custom hooks, context providers | Multiple `useState` + `useEffect` chains doing data orchestration in a UI component |
| Presentation | Components (`.tsx`) | JSX with rendering logic |

**What to flag:**
- Components over 200 lines that touch more than two layers → 🟡 Warning
- Components over 400 lines → 🟡 Warning (almost certainly mixing concerns)
- Business logic (calculations, data transforms, validation) living inside component files instead of `lib/` → 🔵 Suggestion
- The fix recommendation must name the specific files that should be created (e.g., "Extract `calculatePricing()` and `formatOrderSummary()` into `lib/orders/utils.ts`")

## 3. The "Junk Drawer" Problem

Look for files that accumulate unrelated utilities:
- `utils.ts` or `helpers.ts` with functions serving different domains
- `types.ts` at the root with types for every feature
- `constants.ts` with unrelated constants from different features

**What to flag:**
- A `utils` file with functions for 3+ unrelated domains → 🔵 Suggestion to split by domain
- A single `types.ts` over 100 lines covering multiple features → 🔵 Suggestion

## 4. Component Granularity

Check for both extremes:

**Too coarse (god components):** A single component that renders an entire page with multiple interactive sections. Signs: lots of conditional rendering, multiple state variables controlling different UI sections, deeply nested JSX.

**Too fine (over-abstraction):** Components that wrap a single element with no additional logic (`<StyledButton>` that just adds a className). Abstraction without encapsulation adds indirection cost.

**What to flag:**
- Components rendering 3+ distinct UI sections with their own state → 🟡 Warning
- Wrapper components with no additional logic beyond styling that could be a CSS class → 🔵 Suggestion (lower priority — this is preference territory)

## 5. Prop Drilling

When the same props pass through 3+ component levels without being used in intermediate components, that's prop drilling.

**What to flag:**
- Props passing through 3+ levels → 🔵 Suggestion (recommend Context, Zustand, or composition)
- Props passing through 4+ levels → 🟡 Warning

Be specific: name the prop, the origin component, and the consumer component.

## 6. Error Handling Patterns

- [ ] `try/catch` blocks don't silently swallow errors (`catch (e) {}` with empty body or just `console.log`)
- [ ] Error messages are useful for debugging (not `catch (e) { throw new Error("Something went wrong") }` which loses the original error)
- [ ] Async operations have error handling (a bare `await fetch()` without `.catch()` or `try/catch` will cause an unhandled rejection)

**What to flag:**
- Empty catch blocks → 🟡 Warning
- `console.log` as the only error handling → 🟡 Warning
- Unhandled async operations in event handlers → 🟡 Warning

## 7. Code Duplication

Look for patterns repeated across multiple files:
- Same fetch + transform + state pattern in multiple components
- Duplicated validation logic
- Copy-pasted form handling

**What to flag:**
- Same logic block (10+ lines) appearing in 3+ files → 🟡 Warning with suggestion to extract into a shared hook or utility
- Same logic in 2 files → 🔵 Suggestion

## 8. Testing Presence

**Why it matters:** A project with zero tests has zero safety net for refactoring. This doesn't mean 100% coverage is required, but the complete absence of testing infrastructure is a maintainability risk — every change is a gamble.

Check for:
- [ ] A test runner is configured (jest, vitest, playwright, cypress — check `package.json` devDependencies and config files)
- [ ] Test files exist (`.test.ts`, `.test.tsx`, `.spec.ts`, `__tests__/` directories)
- [ ] Critical paths have test coverage — at minimum: auth flows, data mutations (Server Actions), and business logic in `lib/`

**What to flag:**
- No test runner configured and zero test files → 🟡 Warning ("No testing infrastructure detected. At minimum, set up a test runner (Vitest or Jest) and add tests for critical Server Actions and business logic in `lib/`.")
- Test runner configured but fewer than 3 test files → 🔵 Suggestion (testing infrastructure exists but is underused)
- Tests exist but don't cover any Server Actions or auth flows → 🔵 Suggestion

Do not flag the absence of E2E tests or 100% coverage — that's aspirational, not a maintainability defect.

## 9. Naming & Readability

These are lower priority but worth noting:
- Boolean variables/props without `is`/`has`/`should` prefix (e.g., `loading` vs `isLoading`)
- Ambiguous function names (`handleClick` tells you nothing — `handleAddToCart` does)
- Magic numbers/strings without named constants
- Deeply nested ternaries (3+ levels) that should be extracted into a function or early returns

**What to flag:** Only as 🔵 Suggestion, and only if there are clear patterns (not nitpicking individual instances).
