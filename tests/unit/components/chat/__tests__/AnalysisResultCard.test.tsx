import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnalysisResultCard } from '@/components/chat/AnalysisResultCard'
import { AnalysisResult } from '@/types/analysis'

const mockAnalysisResult: AnalysisResult = {
  type: 'pattern',
  name: 'Head and Shoulders',
  confidence: 85,
  description: 'Bearish reversal pattern detected',
  details: {
    leftShoulder: { price: 100, time: '2024-01-01' },
    head: { price: 120, time: '2024-01-02' },
    rightShoulder: { price: 105, time: '2024-01-03' },
    neckline: 95,
  },
  recommendations: [
    'Consider short position below neckline',
    'Set stop loss above right shoulder',
    'Target profit at pattern height below neckline',
  ],
  timestamp: new Date('2024-01-03T10:00:00Z'),
}

describe('AnalysisResultCard', () => {
  it('renders analysis result with all fields', () => {
    render(<AnalysisResultCard result={mockAnalysisResult} />)
    
    expect(screen.getByText('Head and Shoulders')).toBeInTheDocument()
    expect(screen.getByText('Bearish reversal pattern detected')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
    expect(screen.getByText('pattern')).toBeInTheDocument()
  })

  it('displays confidence with appropriate color', () => {
    const { rerender } = render(<AnalysisResultCard result={mockAnalysisResult} />)
    
    // High confidence (>= 80) should be green
    let confidenceBadge = screen.getByText('85%')
    expect(confidenceBadge).toHaveClass('text-green-600')
    
    // Medium confidence (50-79) should be yellow
    rerender(<AnalysisResultCard result={{ ...mockAnalysisResult, confidence: 65 }} />)
    confidenceBadge = screen.getByText('65%')
    expect(confidenceBadge).toHaveClass('text-yellow-600')
    
    // Low confidence (< 50) should be red
    rerender(<AnalysisResultCard result={{ ...mockAnalysisResult, confidence: 30 }} />)
    confidenceBadge = screen.getByText('30%')
    expect(confidenceBadge).toHaveClass('text-red-600')
  })

  it('shows expandable details section', async () => {
    const user = userEvent.setup()
    render(<AnalysisResultCard result={mockAnalysisResult} />)
    
    // Details should be hidden initially
    expect(screen.queryByText('Analysis Details')).not.toBeInTheDocument()
    
    // Click to expand
    await user.click(screen.getByRole('button', { name: /show details/i }))
    
    // Details should now be visible
    expect(screen.getByText('Analysis Details')).toBeInTheDocument()
    expect(screen.getByText(/left shoulder/i)).toBeInTheDocument()
    expect(screen.getByText('$100')).toBeInTheDocument()
  })

  it('displays recommendations list', async () => {
    const user = userEvent.setup()
    render(<AnalysisResultCard result={mockAnalysisResult} />)
    
    await user.click(screen.getByRole('button', { name: /show details/i }))
    
    expect(screen.getByText('Recommendations')).toBeInTheDocument()
    mockAnalysisResult.recommendations.forEach(rec => {
      expect(screen.getByText(rec)).toBeInTheDocument()
    })
  })

  it('formats timestamp correctly', () => {
    render(<AnalysisResultCard result={mockAnalysisResult} />)
    
    // Should show relative time
    expect(screen.getByText(/ago$/)).toBeInTheDocument()
  })

  it('handles analysis without recommendations', () => {
    const resultWithoutRecs = {
      ...mockAnalysisResult,
      recommendations: [],
    }
    
    render(<AnalysisResultCard result={resultWithoutRecs} />)
    
    // Should not crash and display basic info
    expect(screen.getByText('Head and Shoulders')).toBeInTheDocument()
  })

  it('handles analysis without details', async () => {
    const user = userEvent.setup()
    const resultWithoutDetails = {
      ...mockAnalysisResult,
      details: undefined,
    }
    
    render(<AnalysisResultCard result={resultWithoutDetails} />)
    
    await user.click(screen.getByRole('button', { name: /show details/i }))
    
    expect(screen.getByText('No additional details available')).toBeInTheDocument()
  })

  it('displays different analysis types with appropriate icons', () => {
    const { rerender } = render(<AnalysisResultCard result={mockAnalysisResult} />)
    
    // Pattern type
    expect(screen.getByTestId('pattern-icon')).toBeInTheDocument()
    
    // Indicator type
    rerender(<AnalysisResultCard result={{ ...mockAnalysisResult, type: 'indicator' }} />)
    expect(screen.getByTestId('indicator-icon')).toBeInTheDocument()
    
    // Support/Resistance type
    rerender(<AnalysisResultCard result={{ ...mockAnalysisResult, type: 'support_resistance' }} />)
    expect(screen.getByTestId('support-resistance-icon')).toBeInTheDocument()
  })

  it('handles click on action buttons', async () => {
    const user = userEvent.setup()
    const onViewChart = jest.fn()
    const onShare = jest.fn()
    
    render(
      <AnalysisResultCard 
        result={mockAnalysisResult}
        onViewChart={onViewChart}
        onShare={onShare}
      />
    )
    
    await user.click(screen.getByRole('button', { name: /view on chart/i }))
    expect(onViewChart).toHaveBeenCalledWith(mockAnalysisResult)
    
    await user.click(screen.getByRole('button', { name: /share/i }))
    expect(onShare).toHaveBeenCalledWith(mockAnalysisResult)
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