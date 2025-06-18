#!/bin/bash

# Run Parallel Orchestrator Performance Benchmark

echo "🚀 Starting Parallel Orchestrator Performance Benchmark"
echo "======================================================"
echo ""

# Ensure we're in the project root
cd "$(dirname "$0")/.." || exit 1

# Check if tsx is available
if ! command -v tsx &> /dev/null; then
    echo "⚠️  tsx not found. Installing..."
    npm install -D tsx
fi

# Create results directory
mkdir -p tests/performance/results

# Set environment variables for testing
export NODE_ENV=test
export LOG_LEVEL=error  # Reduce logging noise during benchmarks

# Run the benchmark
echo "📊 Running performance benchmark..."
echo ""

tsx tests/performance/parallel-orchestrator-benchmark.ts

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Benchmark completed successfully!"
    echo ""
    echo "📁 Results saved to: tests/performance/results/"
else
    echo ""
    echo "❌ Benchmark failed. Check the error messages above."
    exit 1
fi