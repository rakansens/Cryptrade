# Chart Event Validation Implementation

## Overview

This document describes the Zod schema-based validation system implemented for chart event payloads to improve type safety and runtime validation.

## Implementation Summary

### 1. Created Zod Schemas for Chart Events

**File:** `types/events/chart-events.ts`

Implemented validation schemas for the following critical chart events:

- **AddDrawingEvent**: Validates drawing creation payloads
  - Ensures proper points array structure
  - Validates type-specific requirements (e.g., horizontal lines need price)
  - Provides default values for `visible` and `interactive` properties

- **DeleteDrawingEvent**: Validates drawing deletion payloads
  - Ensures `id` field is present and is a string

- **AddPatternEvent**: Validates pattern creation payloads
  - Validates pattern visualization structure
  - Ensures metrics are properly formatted
  - Validates trading implications and confidence scores

- **UpdateDrawingStyleEvent**: Validates style update payloads
  - Validates color, lineWidth, lineStyle, and showLabels
  - Provides default `immediate` flag

- **UpdatePatternStyleEvent**: Validates pattern style update payloads
  - Validates base style and pattern-specific styles
  - Supports partial updates

### 2. Updated Event Handlers

**File:** `components/chart/hooks/useAgentEventHandlers.ts`

- Added validation to all event handlers before processing
- Improved error handling with specific validation error messages
- Added success toasts for successful operations

Key improvements:
- `handleAddDrawing`: Validates event payload before creating drawing
- `handleDeleteDrawing`: Validates ID before deletion
- `handleAddPattern`: Validates pattern structure before rendering
- `handleUpdateDrawingStyle`: Validates style updates with better error messages
- `handleUpdatePatternStyle`: Validates pattern style updates

### 3. Updated Chat Panel

**File:** `components/chat/ChatPanel.tsx`

- Added validation before dispatching events
- Improved error handling for invalid proposals
- Better user feedback for validation failures

### 4. Utility Functions

Created helper functions for event validation:
- `validateChartEvent`: Generic validation based on event type
- `createValidatedChartEvent`: Creates CustomEvent with validated payload
- `dispatchValidatedChartEvent`: Validates and dispatches event in one call

## Benefits

1. **Type Safety**: Compile-time type checking for event payloads
2. **Runtime Validation**: Catches invalid data before it causes runtime errors
3. **Better Error Messages**: Clear validation errors help debug issues faster
4. **Consistency**: Ensures all events follow the same structure
5. **Documentation**: Schemas serve as documentation for event structure

## Usage Examples

### Dispatching a Validated Event

```typescript
import { dispatchValidatedChartEvent } from '@/types/events/chart-events';

// This will validate the payload before dispatching
dispatchValidatedChartEvent('chart:addDrawing', {
  id: 'drawing_123',
  type: 'trendline',
  points: [
    { time: 1234567890, value: 100 },
    { time: 1234567900, value: 110 }
  ],
  style: {
    color: '#ff0000',
    lineWidth: 2,
    lineStyle: 'solid',
    showLabels: true
  }
});
```

### Manual Validation

```typescript
import { validateAddDrawingEvent } from '@/types/events/chart-events';

try {
  const validatedEvent = validateAddDrawingEvent(eventData);
  // Use validated data
} catch (error) {
  console.error('Invalid event data:', error.message);
}
```

## Testing

Comprehensive test suite created in `types/events/__tests__/chart-events.test.ts` covering:
- Valid event validation
- Invalid event rejection
- Default value application
- Error message formatting

## Future Improvements

1. Add validation for more event types (zoom, pan, indicator updates)
2. Create custom error types for better error handling
3. Add telemetry for validation failures
4. Consider creating a middleware pattern for event validation