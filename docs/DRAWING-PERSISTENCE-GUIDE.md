# Drawing and Pattern Persistence Guide

This guide explains how to properly implement drawing and pattern persistence in the Cryptrade application to prevent data loss during timeframe changes.

## Problem Statement

When users switch timeframes, drawings and patterns disappear from the chart. This happens because:
1. Chart re-initialization clears the canvas
2. Drawing data is not properly persisted
3. Restoration logic is not triggered at the right time

## Solution Architecture

### 1. Data Validation with Zod

All drawing and pattern data is validated using Zod schemas to ensure type safety:

```typescript
// lib/validation/chart-drawing.schema.ts
export const ChartDrawingSchema = z.object({
  id: z.string().min(1),
  type: DrawingTypeSchema,
  points: z.array(DrawingPointSchema).min(1).max(10),
  style: DrawingStyleSchema,
  visible: z.boolean(),
  interactive: z.boolean(),
  metadata: z.record(z.any()).optional()
});
```

### 2. Persistence Manager

The `ChartPersistenceManager` handles all localStorage operations:

```typescript
// lib/storage/chart-persistence.ts
export class ChartPersistenceManager {
  static saveDrawings(drawings: ChartDrawing[]): void
  static loadDrawings(): ChartDrawing[]
  static savePatterns(patterns: Map<string, PatternData>): void
  static loadPatterns(): Map<string, PatternData>
  static saveTimeframeState(symbol: string, timeframe: string): void
  static hasTimeframeChanged(symbol: string, timeframe: string): boolean
}
```

### 3. Store Integration

The chart store automatically persists data when modified:

```typescript
// store/chart.store.ts
addDrawing: (drawing) => {
  // Validate drawing
  const validDrawing = validateDrawing(drawing);
  
  // Update state
  const newDrawings = [...state.drawings, validDrawing];
  
  // Save to localStorage
  ChartPersistenceManager.saveDrawings(newDrawings);
  
  return { drawings: newDrawings };
}
```

### 4. Restoration Hooks

Two specialized hooks handle restoration after timeframe changes:

#### useDrawingRestore
- Monitors timeframe changes
- Restores all drawings from store
- Prevents duplicate restoration
- Handles different drawing types (trendline, horizontal, vertical, fibonacci)

#### usePatternRestore
- Similar to drawing restore but for patterns
- Clears and re-renders patterns after timeframe change

## Implementation Checklist

When implementing drawing persistence:

### ✅ DO:
1. **Validate all data** before saving using Zod schemas
2. **Save immediately** when data changes
3. **Track restoration state** to prevent duplicates
4. **Clear before restoring** to avoid duplicates
5. **Log all operations** for debugging
6. **Handle errors gracefully** - skip invalid items rather than failing entirely

### ❌ DON'T:
1. **Don't reinitialize chart** on timeframe change (only on symbol change)
2. **Don't trust external data** - always validate
3. **Don't restore synchronously** - use setTimeout to ensure chart is ready
4. **Don't forget to clean up** tracking refs when component unmounts

## Code Examples

### Adding a New Drawing Type

1. Update the schema:
```typescript
export const DrawingTypeSchema = z.enum([
  'trendline', 
  'fibonacci', 
  'horizontal', 
  'vertical', 
  'pattern',
  'your-new-type' // Add here
]);
```

2. Update the restoration logic:
```typescript
// In useDrawingRestore.ts
switch (drawing.type) {
  // ... existing cases
  case 'your-new-type':
    drawingManager.addYourNewType(
      drawing.points,
      drawing.style,
      drawing.id
    );
    break;
}
```

### Debugging Persistence Issues

1. Check localStorage:
```javascript
// In browser console
localStorage.getItem('cryptrade_chart_drawings')
localStorage.getItem('cryptrade_chart_patterns')
```

2. Enable verbose logging:
```typescript
logger.info('[ChartStore] Timeframe changed', { 
  timeframe,
  drawingsCount: currentState.drawings.length,
  patternsCount: currentState.patterns.size
});
```

3. Monitor restoration:
```typescript
// In useDrawingRestore.ts
logger.info('[DrawingRestore] Restoring drawings', {
  drawingCount: drawings.length,
  timeframeChanged,
  timeframe
});
```

## Testing

Run the test suites to verify persistence:

```bash
npm test __tests__/chart-persistence.test.ts
npm test __tests__/timeframe-switching.test.ts
```

## Common Issues and Solutions

### Issue: Drawings appear duplicated
**Solution**: Ensure `drawingManager.clearAll()` is called before restoration

### Issue: Drawings don't appear after timeframe change
**Solution**: Check that restoration hooks are properly wired in CandlestickChart.tsx

### Issue: Invalid drawing crashes the app
**Solution**: Wrap restoration in try-catch and validate before adding

### Issue: Performance lag with many drawings
**Solution**: Batch restoration operations and use requestAnimationFrame

## Future Improvements

1. **Compression**: Compress localStorage data for larger datasets
2. **IndexedDB**: Move to IndexedDB for better performance with large data
3. **Cloud Sync**: Add cloud persistence for cross-device sync
4. **Versioning**: Add schema versioning for backward compatibility
5. **Selective Persistence**: Allow users to choose what to persist