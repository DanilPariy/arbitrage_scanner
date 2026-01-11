# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the backend TypeScript service (Fastify server, exchange connectors, arbitrage engine).
- `apps/web/` contains the Next.js frontend (app router, UI, public assets).
- `apps/web/src/` is the main UI source; `apps/web/public/` holds static assets.
- Configuration lives in `src/config/` and environment files like `apps/web/.env.local`.

## Build, Test, and Development Commands
Backend (run from repo root):
- `npm run dev` — start the backend in watch mode (`src/main.ts`).
- `npm run build` — compile TypeScript to `dist/`.
- `npm run start` — run the compiled backend (`dist/main.js`).
- `npm run lint` — lint the backend codebase.
- `npm run format` — format with Prettier.

Frontend (run from `apps/web/`):
- `npm run dev` — start Next.js dev server.
- `npm run build` — build the production bundle.
- `npm run start` — serve the production build.
- `npm run lint` — lint the frontend.

## Coding Style & Naming Conventions
- TypeScript throughout; prefer explicit types at module boundaries.
- Formatting is handled by Prettier (root) and linted by ESLint (root and `apps/web/`).
- Use clear, domain-specific names for exchange adapters and streams (e.g., `binance`, `okx`).

## Testing Guidelines
- No automated test suite is configured yet.
- If you add tests, document the runner and add a `test` script in the relevant `package.json`.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits (e.g., `feat: add OKX market discovery`).
- PRs should include: a concise summary, linked issue (if any), and screenshots for UI changes.
- Note any new environment variables in the PR description.

## Security & Configuration Tips
- Keep secrets in local env files (`.env`, `.env.local`) and out of version control.
- Review `.gitignore` in both root and `apps/web/` before adding new files.
