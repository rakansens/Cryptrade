import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnalysisResultCard, AnalysisResultData } from '@/components/chat/AnalysisResultCard'

// Mock dependencies
jest.mock('@/store/market.store', () => ({
  usePriceData: jest.fn(() => [])
}))

jest.mock('@/hooks/market/use-price-stream', () => ({
  usePriceStream: jest.fn(() => ({
    currentPrice: 50000,
    change: 100,
    changePercent: 0.2
  }))
}))

jest.mock('@/lib/utils/indicators', () => ({
  computeATR: jest.fn(() => 500),
  computeRSI: jest.fn(() => 60),
  computeMACD: jest.fn(() => ({ trend: 'neutral' })),
  computeTrendStrength: jest.fn(() => ({ direction: 'up', strength: 75 })),
  computeSupportResistanceDetailed: jest.fn(() => ({ support: [], resistance: [] }))
}))

const mockAnalysisResult: AnalysisResultData = {
  symbol: 'BTCUSDT',
  timeframe: '1h',
  price: {
    current: 50000,
    change: 500,
    changePercent: 1.0
  },
  trend: {
    direction: 'up',
    strength: 85,
    confidence: 0.9
  },
  support: [
    { price: 49000, strength: 0.8, touches: 3 },
    { price: 48000, strength: 0.6, touches: 2 }
  ],
  resistance: [
    { price: 51000, strength: 0.9, touches: 4 },
    { price: 52000, strength: 0.7, touches: 2 }
  ],
  volatility: {
    atr: 500,
    level: 'medium',
    percentage: 1.0
  },
  momentum: {
    rsi: {
      value: 65,
      signal: 'neutral'
    },
    macd: {
      value: 100,
      signal: 80,
      histogram: 20,
      trend: 'bullish'
    }
  },
  patterns: [{
    name: 'Head and Shoulders',
    description: 'Bearish reversal pattern detected',
    confidence: 85
  }],
  recommendations: [
    'Consider short position below neckline',
    'Set stop loss above right shoulder',
    'Target profit at pattern height below neckline'
  ],
  nextActions: [
    'Monitor price action at resistance level',
    'Watch for volume confirmation'
  ]
}

describe('AnalysisResultCard', () => {
  it('renders analysis result with all fields', () => {
    render(<AnalysisResultCard data={mockAnalysisResult} />)
    
    expect(screen.getByText('BTCUSDT 分析結果')).toBeInTheDocument()
    expect(screen.getByText('1h')).toBeInTheDocument()
    expect(screen.getByText('$50,000')).toBeInTheDocument()
    expect(screen.getByText('+500.00(1.00%)')).toBeInTheDocument()
  })

  it('displays trend information correctly', () => {
    render(<AnalysisResultCard data={mockAnalysisResult} />)
    
    // Check trend direction
    expect(screen.getByText('上昇')).toBeInTheDocument()
    
    // Check trend strength
    expect(screen.getByText('85%')).toBeInTheDocument()
    
    // Check trend confidence
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('displays support and resistance levels', () => {
    render(<AnalysisResultCard data={mockAnalysisResult} />)
    
    // Check support levels
    expect(screen.getByText('$49,000')).toBeInTheDocument()
    expect(screen.getByText('$48,000')).toBeInTheDocument()
    
    // Check resistance levels
    expect(screen.getByText('$51,000')).toBeInTheDocument()
    expect(screen.getByText('$52,000')).toBeInTheDocument()
  })

  it('displays momentum indicators', () => {
    render(<AnalysisResultCard data={mockAnalysisResult} />)
    
    // Check RSI
    expect(screen.getByText('RSI')).toBeInTheDocument()
    expect(screen.getByText('65')).toBeInTheDocument()
    
    // Check MACD
    expect(screen.getByText('MACD')).toBeInTheDocument()
    expect(screen.getByText('強気')).toBeInTheDocument()
  })

  it('displays volatility information', () => {
    render(<AnalysisResultCard data={mockAnalysisResult} />)
    
    // Check volatility level
    expect(screen.getByText('ボラティリティ')).toBeInTheDocument()
    expect(screen.getByText('中')).toBeInTheDocument()
  })

  it('handles analysis without patterns', () => {
    const resultWithoutPatterns = {
      ...mockAnalysisResult,
      patterns: undefined,
    }
    
    render(<AnalysisResultCard data={resultWithoutPatterns} />)
    
    // Should not crash and display basic info
    expect(screen.getByText('BTCUSDT 分析結果')).toBeInTheDocument()
  })

  it('handles analysis without recommendations', () => {
    const resultWithoutRecommendations = {
      ...mockAnalysisResult,
      recommendations: undefined,
    }
    
    render(<AnalysisResultCard data={resultWithoutRecommendations} />)
    
    // Should still display other information
    expect(screen.getByText('BTCUSDT 分析結果')).toBeInTheDocument()
  })

  it('displays patterns when available', () => {
    render(<AnalysisResultCard data={mockAnalysisResult} />)
    
    // Check pattern information
    expect(screen.getByText('パターン')).toBeInTheDocument()
    expect(screen.getByText('Head and Shoulders')).toBeInTheDocument()
    expect(screen.getByText('Bearish reversal pattern detected')).toBeInTheDocument()
  })

  it('handles different trend directions', () => {
    const { rerender } = render(<AnalysisResultCard data={mockAnalysisResult} />)
    
    // Uptrend
    expect(screen.getByText('上昇')).toBeInTheDocument()
    
    // Downtrend
    const downtrendData = {
      ...mockAnalysisResult,
      trend: { ...mockAnalysisResult.trend, direction: 'down' as const }
    }
    rerender(<AnalysisResultCard data={downtrendData} />)
    expect(screen.getByText('下降')).toBeInTheDocument()
    
    // Neutral
    const neutralData = {
      ...mockAnalysisResult,
      trend: { ...mockAnalysisResult.trend, direction: 'neutral' as const }
    }
    rerender(<AnalysisResultCard data={neutralData} />)
    expect(screen.getByText('中立')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<AnalysisResultCard result={mockAnalysisResult} className="custom-card" />)
    
    const card = screen.getByRole('article')
    expect(card).toHaveClass('custom-card')
  })

  it('shows loading state', () => {
    render(<AnalysisResultCard result={mockAnalysisResult} isLoading />)
    
    expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument()
    expect(screen.queryByText('Head and Shoulders')).not.toBeInTheDocument()
  })

  it('handles long descriptions with ellipsis', () => {
    const longDescription = 'A'.repeat(200)
    const resultWithLongDesc = {
      ...mockAnalysisResult,
      description: longDescription,
    }
    
    render(<AnalysisResultCard result={resultWithLongDesc} />)
    
    const description = screen.getByTestId('description')
    expect(description).toHaveClass('line-clamp-2')
  })

  it('displays analysis accuracy if available', () => {
    const resultWithAccuracy = {
      ...mockAnalysisResult,
      accuracy: {
        historical: 78,
        recent: 82,
      },
    }
    
    render(<AnalysisResultCard result={resultWithAccuracy} />)
    
    expect(screen.getByText('Historical: 78%')).toBeInTheDocument()
    expect(screen.getByText('Recent: 82%')).toBeInTheDocument()
  })

  it('handles real-time updates', () => {
    const { rerender } = render(<AnalysisResultCard result={mockAnalysisResult} />)
    
    expect(screen.getByText('85%')).toBeInTheDocument()
    
    // Update confidence
    const updatedResult = {
      ...mockAnalysisResult,
      confidence: 92,
    }
    
    rerender(<AnalysisResultCard result={updatedResult} />)
    expect(screen.getByText('92%')).toBeInTheDocument()
  })

  it('supports compact mode', () => {
    render(<AnalysisResultCard result={mockAnalysisResult} compact />)
    
    // In compact mode, should not show description by default
    expect(screen.queryByText('Bearish reversal pattern detected')).not.toBeInTheDocument()
    
    // But should still show name and confidence
    expect(screen.getByText('Head and Shoulders')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup()
    const onViewChart = jest.fn()
    
    render(
      <AnalysisResultCard 
        result={mockAnalysisResult}
        onViewChart={onViewChart}
      />
    )
    
    // Tab to expand button
    await user.tab()
    expect(screen.getByRole('button', { name: /show details/i })).toHaveFocus()
    
    // Enter to expand
    await user.keyboard('{Enter}')
    expect(screen.getByText('Analysis Details')).toBeInTheDocument()
    
    // Tab to action buttons
    await user.tab()
    expect(screen.getByRole('button', { name: /view on chart/i })).toHaveFocus()
  })

  it('displays price targets if available', async () => {
    const user = userEvent.setup()
    const resultWithTargets = {
      ...mockAnalysisResult,
      priceTargets: {
        primary: 88,
        secondary: 82,
        stopLoss: 108,
      },
    }
    
    render(<AnalysisResultCard result={resultWithTargets} />)
    
    await user.click(screen.getByRole('button', { name: /show details/i }))
    
    expect(screen.getByText('Price Targets')).toBeInTheDocument()
    expect(screen.getByText('Primary: $88')).toBeInTheDocument()
    expect(screen.getByText('Secondary: $82')).toBeInTheDocument()
    expect(screen.getByText('Stop Loss: $108')).toBeInTheDocument()
  })
})