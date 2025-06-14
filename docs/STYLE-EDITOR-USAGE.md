# Style Editor Usage Guide

## Overview

The Style Editor feature allows real-time customization of drawing and pattern styles directly from the proposal UI. This includes modifying colors, line widths, line styles, and pattern-specific properties.

## Features

### Basic Style Options
- **Color**: Select from preset colors or use a custom hex color
- **Line Width**: Adjust thickness from 1 to 10 pixels
- **Line Style**: Choose from solid, dashed, dotted, dash-dot, or long dash patterns
- **Labels**: Toggle visibility of labels on drawings

### Style Presets
Quick access to pre-configured style combinations:
- **Default**: Standard green theme with medium line width
- **Professional**: Blue theme with subtle shadows
- **Minimal**: Gray theme with thin lines and no labels
- **Colorful**: Orange theme with animations

### Pattern-Specific Options
For pattern recognition proposals:
- **Pattern Fill Opacity**: Adjust transparency of pattern areas
- **Metric Label Position**: Choose left, center, or right alignment
- **Metric Labels**: Toggle visibility of TP/SL/BO labels
- **Key Points**: Toggle highlighting of pattern key points

## How to Use

### 1. Approve a Drawing Proposal
First, approve a drawing or pattern proposal from the AI assistant.

### 2. Access Style Editor
Hover over the approved proposal to reveal the action buttons. Click the "スタイル" (Style) button.

### 3. Customize Styles

#### Basic Tab
1. **Change Color**: 
   - Click the color preview box to open system color picker
   - Enter hex code directly in the input field
   - Select from quick color presets

2. **Adjust Line Width**:
   - Use the slider to change thickness
   - View real-time preview on the chart

3. **Select Line Style**:
   - Choose from dropdown menu
   - Options include solid, dashed, dotted, etc.

4. **Toggle Labels**:
   - Click the switch to show/hide labels

#### Presets Tab
Click any preset to instantly apply a complete style configuration.

#### Pattern Tab (Pattern proposals only)
1. **Pattern Fill Opacity**: Adjust transparency with slider
2. **Metric Label Position**: Select alignment from dropdown
3. **Toggle Options**: Use switches for labels and key points

### 4. Real-time Updates
All changes are applied immediately to the chart. No need to save or confirm.

## Technical Implementation

### Zod Schema Validation
All style updates are validated using Zod schemas to ensure type safety:

```typescript
// Example style update
const styleUpdate: StyleUpdateEvent = {
  drawingId: 'drawing-123',
  style: {
    color: '#3b82f6',
    lineWidth: 3,
    lineStyle: 'dashed'
  },
  immediate: true
}
```

### Event System
Style updates are handled through custom events:
- `chart:updateDrawingStyle` - Updates drawing styles
- `chart:updatePatternStyle` - Updates pattern-specific styles

### Component Structure
```
StyleEditor
├── Basic Settings Tab
│   ├── Color Picker
│   ├── Line Width Slider
│   ├── Line Style Select
│   └── Show Labels Toggle
├── Presets Tab
│   └── Preset Options
└── Pattern Tab (conditional)
    ├── Fill Opacity Slider
    ├── Label Position Select
    └── Toggle Options
```

## Error Handling

The Style Editor includes comprehensive error handling:
- Invalid color formats are rejected
- Out-of-range values are constrained
- Failed updates show error toasts
- Validation errors are logged for debugging

## Testing

### Unit Tests
- Component rendering and interaction
- Style validation
- Event dispatching
- Error handling

### Integration Tests
- Event flow validation
- Store updates
- Handler execution
- Backward compatibility

### E2E Tests
- Complete user workflows
- Real-time updates
- Multi-drawing scenarios
- Error scenarios

## Future Enhancements

Potential additions to the Style Editor:
1. Custom dash patterns
2. Gradient colors
3. Animation controls
4. Style templates/themes
5. Bulk style updates
6. Style history/undo
7. Advanced pattern visualizations
8. Export/import style configurations

## Troubleshooting

### Styles Not Updating
1. Check browser console for errors
2. Verify drawing ID matches
3. Ensure event handlers are registered
4. Check if drawing manager is initialized

### Color Picker Not Working
1. Verify hex color format (#RRGGBB)
2. Check browser compatibility
3. Try using preset colors

### Pattern Styles Not Available
1. Confirm proposal type is 'pattern'
2. Check if pattern renderer is initialized
3. Verify pattern has metrics data