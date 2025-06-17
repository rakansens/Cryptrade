# Component Architecture

## Component Organization Strategy

### Directory Structure
```
components/
├── alerts/          # Alert-specific components
├── chart/           # Chart-related components
│   ├── core/        # Core chart components
│   ├── hooks/       # Chart-specific hooks
│   ├── indicators/  # Indicator components
│   └── toolbar/     # Chart toolbar components
├── chat/            # Chat interface components
├── home/            # Home page components
├── layout/          # Layout wrapper components
├── logs/            # Log viewing components
├── providers/       # Context providers
├── shared/          # Shared reusable components
│   ├── analysis/    # Analysis-related shared components
│   └── ui/          # UI primitives
└── ui/              # Base UI components (shadcn/ui)
```

### Layering Strategy
1. **UI Layer** (`ui/`): Base components from shadcn/ui library
2. **Shared Layer** (`shared/`): Reusable business components
3. **Feature Layer** (e.g., `chart/`, `chat/`): Feature-specific components
4. **Provider Layer** (`providers/`): Context and state providers

## Naming Conventions

### Component Files
- **PascalCase** for component files: `ChatPanel.tsx`, `CandlestickChart.tsx`
- **kebab-case** for UI primitives: `button.tsx`, `scroll-area.tsx`
- **Descriptive names** indicating purpose: `MessageInput.tsx`, `ProposalCard.tsx`

### Component Names
- React components use **PascalCase**: `export function ChatPanel()`
- Default exports for main components
- Named exports for utility components and types

### Hook Files
- **camelCase** with `use` prefix: `useChartData.ts`, `useProposalManagement.ts`
- Located in feature-specific `hooks/` directories or root `hooks/` directory

## State Management Patterns

### Zustand Stores
- Modular store architecture with feature-based splitting
- Legacy compatibility wrappers for backward compatibility
- Store files follow pattern: `[feature].store.ts`

### Store Patterns
```typescript
// Base store with type safety
const useChartBaseStore = create<ChartBaseState>((set) => ({
  // State
  symbol: 'BTCUSDT',
  // Actions
  setSymbol: (symbol) => set({ symbol }),
}));

// Combined store for backward compatibility
export const useChartStore = <T>(selector: (state: ChartStore) => T): T => {
  // Combines multiple stores
};
```

### Context Providers
- Database sync provider: `DbStoreProvider`
- UI event provider: `UIEventProvider`
- Typed event provider: `TypedUIEventProvider`

## Prop Typing Approach

### TypeScript First
- All components use TypeScript with explicit prop interfaces
- Centralized type definitions in `types/` directory
- Shared types for consistency across components

### Interface Pattern
```typescript
interface ComponentProps {
  children?: React.ReactNode;
  className?: string;
  onAction?: (param: Type) => void;
}

export function Component({ children, className, onAction }: ComponentProps) {
  // Implementation
}
```

### Type Organization
- Feature-specific types in `types/[feature].types.ts`
- Shared types in `types/shared/`
- API types in `types/api/`
- Event types in `types/events/`

## Component Composition Patterns

### Children Pattern
- Used extensively for layout components
- Providers wrap children for context injection
- Layout components accept children for flexible composition

### Compound Components
- Chart components with sub-components (e.g., IndicatorPanel with charts)
- Tab-based interfaces (Tabs, TabsList, TabsTrigger, TabsContent)

### Custom Hooks for Logic
- Business logic extracted to custom hooks
- Separation of concerns: UI components focus on rendering
- Examples: `useMessageHandling`, `useProposalManagement`

### Ref Forwarding
```typescript
const Component = React.forwardRef<HTMLElement, Props>((props, ref) => {
  // Implementation
});
```

### Component Variants
- Using `class-variance-authority` (cva) for variant management
- Consistent styling approach across UI components
- Example: Button variants (default, destructive, success, etc.)

### Responsive Design
- Resizable panels using `@radix-ui/react-resizable`
- Mobile-responsive layouts with conditional rendering
- CSS variables for theming support

### Performance Patterns
- `'use client'` directive for client components
- Lazy loading with dynamic imports
- Memoization where appropriate
- Stable keys for list rendering

## Component Documentation

### Documentation Pattern
Components use JSDoc-style comments for documentation:

```typescript
/**
 * A reusable layout component that provides a full-height flex container
 * with optional header and footer sections that don't scroll.
 * The main content area fills the remaining space and can scroll if needed.
 */
export function FullHeightLayout({ ... })
```

### Limited Documentation
- Most components lack formal documentation
- Documentation exists primarily in complex or reusable layout components
- Type interfaces serve as implicit documentation through prop definitions