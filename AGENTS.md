# Repository Guidelines

## Project Structure & Module Organization

This repository is a Next.js App Router dashboard migrated from the legacy static `index.html`.

- `app/`: application routes, layout, global CSS, and API route handlers. The Naver price proxy lives in `app/api/naver-price/route.ts`.
- `components/ui/`: local shadcn-style UI primitives such as `Button`, `Card`, `Table`, and `AlertDialog`.
- `features/dashboard/`: dashboard data hooks and feature-level state integration.
- `hooks/`: reusable client hooks and helpers, including Firebase Storage upload/delete helpers.
- `lib/`: shared utilities, Firebase client setup, and default dashboard data.
- `types/`: shared TypeScript domain types.
- `netlify/functions/naver-price.js`: legacy Netlify function retained only as migration reference.

No dedicated test directory exists yet. Add tests near the relevant feature or under `__tests__/` when a test framework is introduced.

## Build, Test, and Development Commands

Use `pnpm` for all package operations.

- `pnpm dev`: start the local Next.js development server.
- `pnpm build`: create a production build and run TypeScript checks.
- `pnpm start`: serve the production build after `pnpm build`.
- `pnpm lint`: run ESLint across the repository.

There is currently no `pnpm test` script.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Prefer explicit domain types from `types/dashboard.ts` over inline `any` shapes. Use two-space indentation, double quotes, and semicolons, matching the existing files.

Keep UI styling in Tailwind `className` strings and shared shadcn-style primitives. Use `cn()` from `lib/utils.ts` for conditional class composition. Component files should use kebab-case names for UI primitives, while exported React components use PascalCase.

Use shadcn semantic tokens (`background`, `foreground`, `card`, `muted`, `accent`, `primary`, `destructive`, `border`, `ring`, `chart-*`) before adding direct Tailwind palettes or hex values. Avoid one-off `#...`, `slate-*`, `emerald-*`, or arbitrary shadow/color utilities unless the design system explicitly introduces them.

## React & Next.js Standards

Follow App Router and React hydration rules. Do not render changing values such as `new Date()`, `Date.now()`, `Math.random()`, locale-formatted dates, or browser-only state during the server/client initial render. Initialize them after mount with `useEffect`, or render a stable placeholder first.

Access `NEXT_PUBLIC_*` variables with static property reads such as `process.env.NEXT_PUBLIC_FIREBASE_API_KEY`; dynamic `process.env[name]` access is not inlined into client bundles. Keep browser APIs (`window`, `document`, `localStorage`) inside event handlers or effects. Resolve React and Next warnings instead of suppressing them unless there is a documented reason.

## Testing Guidelines

Until a test framework is added, validate changes with:

```bash
pnpm lint
pnpm build
```

When an error occurs during development, immediately inspect the failing command output or relevant runtime logs before continuing. Fix the root cause or document the blocker rather than moving on with an unresolved error.

For data or Firebase behavior, manually verify that existing `dashboard` payload fields remain backward compatible. Do not change Firebase paths or Storage paths without a migration plan.

## Commit & Pull Request Guidelines

Recent history uses generic upload-style commits, so no strict convention is established. Prefer concise imperative messages, for example `Add dashboard storage helper` or `Fix Tailwind config`.

Pull requests should include a short summary, verification commands run, screenshots for UI changes, and notes for Firebase or API behavior changes. Link related issues when available.

Agents should create local commits when requested, but must not run `git push` unless the user explicitly asks for a push in the current turn. Leave pushing to the user by default.

## Security & Configuration Tips

Firebase config must be supplied through `NEXT_PUBLIC_FIREBASE_*` environment variables. Keep real values in `.env.local` or deployment settings, and commit only `.env.example`.

Client Firebase config is visible in browser bundles by design. Protect data with Firebase Realtime Database and Storage rules, and restrict or rotate exposed Google API keys. Keep destructive actions behind confirmation UI. Preserve the Naver API response shape: `{ prices: Record<string, number | null> }`.
