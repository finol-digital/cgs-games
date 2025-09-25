# Copilot Instructions for CGS Games

## Project Overview

- **Purpose:** Web platform for Card Game Simulator (CGS) users to share games.
- **Tech Stack:** Next.js (App Router), Firebase (Firestore, Auth, Hosting, Emulators), TailwindCSS.
- **Structure:**
  - `__tests__/` – Unit tests
  - `app/` – Next.js app router pages and API routes
  - `components/` – React UI components
  - `lib/` – Shared logic, context, hooks, Firebase integration
  - `public/` – Static assets

## Key Workflows

- **Install dependencies:** `npm install`
- **Format code:** `prettier --config .prettierrc.json --ignore-path .gitignore --write .`
- **Lint:** `npm run lint`
- **Test:** `npm run test`
- **Build:** `npm run build`
- **Start (local):** `npm run start`
- **Emulate Firebase:** `firebase emulators:start` (uses `apphosting.local.yaml`)
- **Deploy:** Merge PR from `develop` to `main` (auto-deploy via Firebase App Hosting)

## Patterns & Conventions

- **Routing:** Uses Next.js App Router (`app/`). API endpoints in `app/api/`.
- **User Context:** Provided via `components/userContextProvider.tsx` and `lib/context.ts`.
- **Game Data:** Managed via Firestore, logic in `lib/game.ts` and `lib/firebase/firestore.ts`.
- **Authentication:** Firebase Auth, logic in `lib/firebase/auth.ts`.
- **Forms:** Custom forms (e.g., `components/uploadGameForm.tsx`, `components/usernameForm.tsx`).
- **Environment:** Local emulation uses `apphosting.local.yaml` for Firebase config.

## Integration Points

- **Firebase:** Firestore, Auth, Hosting, Emulators. See `lib/firebase/` for integration code.
- **External APIs:** Proxy endpoints in `app/api/proxy/[...url]/route.ts`.

## Examples

- **Add a new API route:** Create a file in `app/api/[route]/route.ts`.
- **Add a new page:** Create a file in `app/[page]/page.tsx`.
- **Update game logic:** Edit `lib/game.ts` and related Firestore logic in `lib/firebase/firestore.ts`.

## Tips for AI Agents

- Prefer using existing context providers and hooks for user/game state.
- Follow Next.js and Firebase conventions as implemented (not generic ones).
- Reference `README.md` for up-to-date workflow commands.
- When in doubt, check for patterns in `components/` and `lib/` before introducing new ones.
