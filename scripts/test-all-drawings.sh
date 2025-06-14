#!/bin/bash

# Test All Drawing Types
# This script demonstrates all drawing types implemented in Phase 1 & Phase 2

echo "🎨 Testing All Drawing Types..."
echo "================================"
echo ""

# Open browser at localhost:3000
open http://localhost:3000

echo "📝 Copy and paste these commands in the browser console:"
echo ""

cat << 'EOF'
// 1. Horizontal Line (Phase 1)
window.dispatchEvent(new CustomEvent('chart:addDrawing', {
  detail: {
    id: 'demo_horizontal_1',
    type: 'horizontal',
    points: [{ time: Date.now(), price: 45000 }],
    style: { color: '#4CAF50', lineWidth: 2, lineStyle: 'solid', showLabels: true }
  }
}));

// 2. Trendline (Phase 2)
window.dispatchEvent(new CustomEvent('chart:addDrawing', {
  detail: {
    id: 'demo_trend_1',
    type: 'trendline',
    points: [
      { time: Date.now() - 300000, price: 44000 },
      { time: Date.now(), price: 46000 }
    ],
    style: { color: '#2196F3', lineWidth: 2, lineStyle: 'solid', showLabels: true }
  }
}));

// 3. Fibonacci Retracement (Phase 2)
window.dispatchEvent(new CustomEvent('chart:addDrawing', {
  detail: {
    id: 'demo_fib_1',
    type: 'fibonacci',
    points: [
      { time: Date.now() - 600000, price: 43000 },
      { time: Date.now(), price: 47000 }
    ],
    style: { color: '#FF9800', lineWidth: 1, lineStyle: 'dashed', showLabels: true }
  }
}));

// Check store state
console.log('Drawings:', window.useChartStore?.getState().drawings);

// Test Undo
window.dispatchEvent(new CustomEvent('chart:undo', { detail: {} }));

// Test Redo
window.dispatchEvent(new CustomEvent('chart:redo', { detail: {} }));
EOF

echo ""
echo "================================"
echo "✅ Test commands ready to use!"
echo ""
echo "Optional: Run E2E tests"
echo "  npm run test:e2e horizontal-line-render.spec.ts"
echo "  npm run test:e2e drawing-types-phase2.spec.ts"
echo ""
echo "Optional: Run performance test"
echo "  node scripts/performance-test-drawings.js"