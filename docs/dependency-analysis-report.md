# Dependency Analysis Report for Cryptrade

## Summary (日本語)
Cryptradeは仮想通貨取引アプリで、Next.js 15とReact 18を基盤に、AI機能（OpenAI/Mastra）、リアルタイムチャート（lightweight-charts）、Supabase認証を統合。開発ツールはJest、Playwright、TypeScript 5.2を使用。

## Core Dependencies (Production)

### UI Framework & Components
- **Next.js**: `15.3.3` - React framework for production
- **React**: `^18.3.1` - UI library
- **React DOM**: `^18.3.1` - React DOM renderer
- **Framer Motion**: `^12.16.0` - Animation library
- **Lucide React**: `^0.358.0` - Icon library

### UI Component Libraries
- **@radix-ui/react-***: Multiple components (dialog, label, popover, scroll-area, select, separator, slot, switch, tabs)
  - Version range: `^1.1.0` to `^2.1.1`
- **Class Variance Authority**: `^0.7.1` - CSS utility classes
- **Tailwind Merge**: `^2.2.2` - Tailwind CSS class merging
- **Tailwindcss Animate**: `^1.0.7` - Animation utilities

### AI & Machine Learning
- **@ai-sdk/openai**: `^1.3.22` - OpenAI SDK
- **@mastra/core**: `^0.10.5` - Mastra AI framework
- **@tensorflow/tfjs**: `^4.22.0` - TensorFlow.js for ML

### Database & Authentication
- **@supabase/supabase-js**: `^2.50.0` - Supabase client
- **@supabase/auth-helpers-nextjs**: `^0.10.0` - Next.js auth helpers
- **@supabase/auth-helpers-react**: `^0.5.0` - React auth helpers
- **@supabase/ssr**: `^0.6.1` - Server-side rendering support

### Data Storage & Caching
- **@upstash/redis**: `^1.35.0` - Redis client
- **@vercel/kv**: `^3.0.0` - Vercel KV storage

### Monitoring & Error Tracking
- **@sentry/nextjs**: `^9.29.0` - Sentry for Next.js
- **@sentry/node**: `^9.29.0` - Sentry for Node.js

### Charting & Visualization
- **Lightweight Charts**: `^4.1.3` - Trading charts library
- **Blessed**: `^0.1.81` - Terminal UI library
- **Blessed Contrib**: `^4.11.0` - Terminal dashboard widgets

### State Management & Utilities
- **Zustand**: `^5.0.5` - State management
- **RxJS**: `^7.8.2` - Reactive programming
- **Zod**: `^3.25.45` - Schema validation
- **Immer**: `^10.1.1` - Immutable state updates
- **Clsx**: `^2.1.0` - Conditional class names

### Other Utilities
- **Eventsource**: `^4.0.0` - Server-sent events
- **Isomorphic DOMPurify**: `^2.25.0` - HTML sanitization
- **React Resizable Panels**: `^2.1.3` - Resizable panels
- **Glob**: `^11.0.3` - File pattern matching

## Development Dependencies

### Testing Framework
- **Jest**: `^29.7.0` - Testing framework
- **@testing-library/react**: `^16.3.0` - React testing utilities
- **@testing-library/jest-dom**: `^6.6.3` - DOM matchers for Jest
- **Jest Environment JSDOM**: `^30.0.0` - JSDOM environment
- **@playwright/test**: `^1.53.0` - E2E testing
- **MSW**: `^2.8.7` - API mocking
- **Puppeteer**: `^24.10.0` - Browser automation

### TypeScript & Type Definitions
- **TypeScript**: `5.2.2` - TypeScript compiler
- **@types/node**: `20.6.2`
- **@types/react**: `18.2.22`
- **@types/react-dom**: `18.2.7`
- **@types/jest**: `^29.5.14`
- **@types/dompurify**: `^3.0.5`
- **@types/node-fetch**: `^2.6.12`
- **@types/better-sqlite3**: `^7.6.13`

### Build Tools & Bundlers
- **Autoprefixer**: `10.4.15` - CSS vendor prefixes
- **PostCSS**: `^8.5.5` - CSS processing
- **Tailwind CSS**: `3.3.3` - Utility-first CSS

### Database & ORM
- **@prisma/client**: `^6.9.0` - Prisma ORM client
- **Better SQLite3**: `^11.10.0` - SQLite database

### Linting & Formatting
- **ESLint**: `8.49.0` - JavaScript linter
- **ESLint Config Next**: `13.5.1` - Next.js ESLint config
- **Husky**: `^8.0.3` - Git hooks
- **Lint Staged**: `^15.2.0` - Run linters on staged files

### Development Utilities
- **Dotenv**: `^16.5.0` - Environment variables
- **TS Jest**: `^29.4.0` - TypeScript Jest transformer
- **TS Node**: `^10.9.1` - TypeScript execution
- **Node Fetch**: `^3.3.2` - Fetch API for Node.js

## Version Constraints & Patterns

### Exact Versions
- Next.js: `15.3.3` (exact version specified)
- TypeScript: `5.2.2` (exact version specified)
- Autoprefixer: `10.4.15` (exact version specified)

### Caret Ranges (^)
Most dependencies use caret ranges, allowing patch and minor updates:
- React ecosystem: `^18.3.1`
- Testing libraries: `^29.x.x` for Jest, `^16.3.0` for React Testing Library
- UI components: Various `^1.x.x` and `^2.x.x` versions

### Notable Overrides
```json
{
  "overrides": {
    "nanoid": "^5.0.0",
    "xml2js": "^0.6.0"
  }
}
```

## Dependency Categories

### 1. **Core Application** (7 packages)
- Next.js, React, React DOM, TypeScript

### 2. **UI Components & Styling** (20+ packages)
- Radix UI components, Tailwind CSS, Framer Motion, Lucide icons

### 3. **AI & Machine Learning** (3 packages)
- OpenAI SDK, Mastra framework, TensorFlow.js

### 4. **Database & Authentication** (5 packages)
- Supabase suite, Prisma ORM

### 5. **Testing & Quality** (10+ packages)
- Jest, Playwright, Testing Library, ESLint

### 6. **Monitoring & Analytics** (2 packages)
- Sentry for error tracking

### 7. **State Management & Data Flow** (4 packages)
- Zustand, RxJS, Immer

### 8. **Charting & Visualization** (3 packages)
- Lightweight Charts, Blessed for terminal UI

### 9. **Build & Development Tools** (15+ packages)
- Various TypeScript types, build tools, and dev utilities

## Potential Issues & Recommendations

### Version Conflicts
- No major conflicts detected
- All React-related packages are aligned on version 18.3.1

### Security Considerations
- Regular updates recommended for security-sensitive packages:
  - `@supabase/*` packages for authentication
  - `isomorphic-dompurify` for XSS prevention
  - `@sentry/*` for secure error tracking

### Performance Considerations
- Large dependencies that might impact bundle size:
  - `@tensorflow/tfjs`: Machine learning library
  - `lightweight-charts`: Charting library
  - Consider code splitting for these heavy dependencies

### Maintenance Notes
- TypeScript is pinned to version 5.2.2 (consider updating)
- Next.js 15.3.3 is a recent version
- Most UI components use stable versions with caret ranges