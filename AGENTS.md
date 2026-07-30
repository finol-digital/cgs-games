# AGENTS.md - CGS Games Development Guide

This file contains guidelines and commands for AI agents working on the CGS Games project.

## Project Overview

- **Purpose**: Web platform for Card Game Simulator (CGS) users to share games
- **Tech Stack**: Next.js 16 (App Router), Firebase (Firestore, Auth, Hosting), TypeScript, TailwindCSS, Jest
- **Structure**:
  - `__tests__/` - Unit tests (Jest + Testing Library)
  - `app/` - Next.js app router pages and API routes
  - `components/` - React UI components
  - `lib/` - Shared logic, context, hooks, Firebase integration
  - `public/` - Static assets

## Essential Commands

### Development Workflow

```bash
# Install dependencies
npm install

# Start development server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

### Code Quality

```bash
# Lint all files
npm run lint

# Format all files
prettier --config .prettierrc.json --ignore-path .gitignore --write .

# Run all tests
npm run test

# Run single test file
npm test -- __tests__/filename.test.jsx

# Run tests in watch mode
npm test -- --watch
```

### Firebase

```bash
# Start Firebase emulators (for local development)
firebase emulators:start

# Deploy to Firebase (merge PR from develop to main)
# Auto-deployment via Firebase App Hosting
```

### GATCG Spoiler Cache

`/api/gatcg_spoilers` OCRs card images, which is far too slow to do inside a
request. Firestore holds two caches: per-card OCR text (`gatcg_ocr_cache`) and
the fully assembled response (`gatcg_spoiler_cache/current`). A normal request
is a single document read; a rebuild is bounded by a wall-clock budget and
defers any OCR that doesn't fit to the next request.

```bash
# Warm the cache with no OCR budget (drains the whole backlog).
# Run against a dev server, which writes to the Firestore in .env:
npm run dev
curl "http://localhost:3000/api/gatcg_spoilers?warm=1"

# Re-OCR every card from scratch, ignoring cached text:
curl "http://localhost:3000/api/gatcg_spoilers?warm=1&refresh=1"
```

In production `warm=1` requires `Authorization: Bearer $GATCG_WARM_TOKEN`, and
returns 401 unless that secret is configured. `nocache=1` (skip the assembled
payload cache but still use the OCR cache) needs the same authorization, and is
ignored otherwise - bypassing the cache is exactly the load it exists to absorb. Bump `OCR_VERSION` in
`lib/firebase/admin.ts` to invalidate cached text after changing the OCR
pipeline; cached text is otherwise only invalidated by a change of image URL.

Note that silvie.gg's API reports card images under `/img/spoilers/...`, but
that path only has static files for older sets - the set currently being
spoiled 404s there and is served solely by `/api/images/spoilers/...`.
`resolveImageUrl` in `lib/gatcgSpoilers.ts` rewrites every image onto the API
route, which serves all sets.

## Code Style Guidelines

### TypeScript & React Patterns

- **Strict TypeScript**: All files must be strictly typed (`"strict": true` in tsconfig.json)
- **Interface definitions**: Use `export default interface` for data models (see `lib/game.ts`)
- **Component props**: Define explicit prop types with TypeScript interfaces
- **Client components**: Add `'use client';` directive at top of client-side components
- **Imports**: Use absolute imports with `@/` alias (e.g., `@/lib/firebase/firebase`)

### Import Organization

```typescript
// 1. Directives and React/Next.js imports
'use client';
import React from 'react';
import Link from 'next/link';

// 2. Third-party libraries
import { useContext, useState } from 'react';
import { auth } from '@/lib/firebase/firebase';

// 3. Local imports (absolute paths)
import Game from '@/lib/game';
import { UserContext } from '@/lib/context';
import Banner from './banner';
import { Card, CardAction } from './ui/card';
```

### Component Structure

- **File naming**: camelCase for components (e.g., `gameCard.tsx`)
- **Export pattern**: Default export for components
- **Props interface**: Define inline or above component
- **State management**: Use React hooks (`useState`, `useContext`, etc.)

### Firebase Integration

- **Auth**: Use `@/lib/firebase/auth.ts` for authentication logic
- **Firestore**: Use `@/lib/firebase/firestore.ts` for database operations
- **Configuration**: Firebase config in `@/lib/firebase/firebase.ts`
- **Admin operations**: Use `@/lib/firebase/admin.ts` for server-side operations

### Error Handling

- **Async operations**: Use try-catch blocks with proper error logging
- **User feedback**: Show user-friendly error messages via `alert()` or toast
- **API errors**: Check response.ok and handle error responses appropriately
- **Loading states**: Use boolean state for loading indicators

### Styling Conventions

- **TailwindCSS**: Use utility classes for styling
- **Component variants**: Use class-variance-authority pattern for UI components
- **Dark theme**: Default to dark theme classes (e.g., `bg-slate-800`)
- **Responsive**: Use responsive prefixes (`md:`, `lg:`) when needed

### Testing Patterns

- **Test files**: Place in `__tests__/` directory with `.test.{js,jsx,ts,tsx}` extension
- **Testing Library**: Use `@testing-library/react` and `@testing-library/jest-dom`
- **Test structure**: Use `describe()`, `it()`, `expect()` patterns
- **Jest globals**: Available in test files (see eslint.config.mjs for globals)

### File Naming & Structure

- **Components**: camelCase (e.g., `gameCard.tsx`, `userMenu.tsx`)
- **Utilities**: camelCase (e.g., `utils.ts`, `hooks.ts`)
- **Pages**: `page.tsx` (App Router convention)
- **API routes**: `route.ts` in `app/api/` directories
- **Types**: Use interfaces in dedicated files or inline

### API Route Patterns

- **File structure**: `app/api/[route]/route.ts`
- **HTTP methods**: Export named functions (GET, POST, DELETE, etc.)
- **Authentication**: Verify Firebase ID tokens in Authorization header
- **Error handling**: Return appropriate HTTP status codes and error messages

### State Management

- **Context**: Use `UserContext` from `@/lib/context` for user state
- **Local state**: Use React hooks for component-level state
- **Firebase hooks**: Use `react-firebase-hooks` for Firebase integration
- **Form state**: Use controlled components with useState

### Security Best Practices

- **Authentication**: Always verify user tokens in API routes
- **Data validation**: Validate input data on both client and server
- **Firestore rules**: Implement proper security rules in `firestore.rules`
- **Environment variables**: Use `.env` for sensitive configuration

## Development Workflow

1. **Before coding**: Run `npm install` to ensure dependencies are current
2. **During development**: Use `npm run dev` with Turbopack for fast refresh
3. **After changes**: Run `npm run lint` and `prettier` to ensure code quality
4. **Before committing**: Run `npm run test` to verify tests pass
5. **Before deployment**: Run `npm run build` to ensure production build works

## Common Patterns

### Game Data Operations

```typescript
// Fetch games
import { getAllGames, getGamesFor } from '@/lib/firebase/firestore';

// Game interface
import Game from '@/lib/game';
```

### User Authentication

```typescript
// Auth operations
import { auth } from '@/lib/firebase/firebase';
import { UserContext } from '@/lib/context';

// Get current user
const user = auth.currentUser;
const idToken = await user?.getIdToken();
```

### Component with State

```typescript
const [isLoading, setIsLoading] = useState(false);
const { username } = useContext(UserContext);

const handleAction = async () => {
  setIsLoading(true);
  try {
    // API call or operation
  } catch (error) {
    console.error('Error:', error);
    alert(error instanceof Error ? error.message : 'Operation failed');
  } finally {
    setIsLoading(false);
  }
};
```

## Firebase Emulator Setup

- Use `apphosting.local.yaml` for local Firebase configuration
- Start emulators with `firebase emulators:start`
- Test API routes locally before deployment

## Deployment

- **Main branch**: Auto-deploys to Firebase App Hosting
- **PR workflow**: Create PR from `develop` to `main`
- **Build verification**: CI/CD runs tests and build checks
- **Environment**: Production Firebase hosting and services

## Notes for AI Agents

- Always check existing patterns in `components/` and `lib/` before introducing new approaches
- Follow the established Firebase integration patterns rather than generic examples
- Use absolute imports with `@/` alias consistently
- Test thoroughly with Jest before considering code complete
- Ensure all TypeScript types are properly defined and strict mode is satisfied
- Follow Next.js App Router conventions for pages and API routes
