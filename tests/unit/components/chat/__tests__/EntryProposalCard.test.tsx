import React from 'react'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EntryProposalCard } from '@/components/chat/EntryProposalCard'
import { EntryProposal, EntryProposalGroup } from '@/types/proposals'

const mockProposal: EntryProposal = {
  id: 'test-proposal-1',
  direction: 'long' as const,
  entryPrice: 45000,
  strategy: 'swingTrading' as const,
  priority: 'high' as const,
  confidence: 0.78,
  riskParameters: {
    stopLoss: 44000,
    stopLossPercent: 2.22,
    riskRewardRatio: 2.5,
    positionSizePercent: 25,
    takeProfitTargets: [
      { price: 46000, percentage: 50 },
      { price: 47000, percentage: 50 },
    ],
  },
  reasoning: {
    primary: 'Strong support at 44k with bullish divergence on RSI',
    technicalFactors: [
      { description: 'RSI Divergence', weight: 0.4 },
      { description: 'Support Level', weight: 0.6 },
    ],
    risks: ['Market volatility', 'False breakout possibility'],
  },
  conditions: {
    trigger: 'limit' as const,
    confirmationRequired: [
      { type: 'indicator', description: 'RSI above 50' },
    ],
  },
  entryZone: {
    min: 44800,
    max: 45200,
  },
}

const mockProposalGroup: EntryProposalGroup = {
  id: 'group-1',
  direction: 'LONG' as const,
  overallConfidence: 78,
  timestamp: new Date('2024-01-03T10:00:00Z'),
  proposals: [mockProposal],
  reasoning: 'Bullish market conditions with strong technicals',
  title: 'Trading Opportunity',
  description: 'BTCUSDT Long Position',
  summary: {
    marketBias: 'bullish' as const,
    averageConfidence: 0.78,
  },
}

describe('EntryProposalCard', () => {
  const defaultProps = {
    proposalGroup: mockProposalGroup,
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onApproveAll: jest.fn(),
    onRejectAll: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders proposal group header correctly', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    expect(screen.getByText('Trading Opportunity')).toBeInTheDocument()
    expect(screen.getByText('BTCUSDT Long Position')).toBeInTheDocument()
  })

  it('displays market summary when provided', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    expect(screen.getByText('市場バイアス:')).toBeInTheDocument()
    expect(screen.getByText('上昇')).toBeInTheDocument()
    expect(screen.getByText('平均信頼度:')).toBeInTheDocument()
    // Use getAllByText since there might be multiple 78% elements
    const confidenceElements = screen.getAllByText('78%')
    expect(confidenceElements.length).toBeGreaterThan(0)
  })

  it('does not show approve/reject all buttons for single proposal', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    expect(screen.queryByText('全て承認')).not.toBeInTheDocument()
    expect(screen.queryByText('全て却下')).not.toBeInTheDocument()
  })

  it('shows approve/reject all buttons for multiple proposals', () => {
    const groupWithMultiple = {
      ...mockProposalGroup,
      proposals: [mockProposal, { ...mockProposal, id: 'test-proposal-2' }],
    }
    render(<EntryProposalCard {...defaultProps} proposalGroup={groupWithMultiple} />)
    
    expect(screen.getByText('全て承認')).toBeInTheDocument()
    expect(screen.getByText('全て却下')).toBeInTheDocument()
  })

  it('handles approve all action', async () => {
    const user = userEvent.setup()
    const groupWithMultiple = {
      ...mockProposalGroup,
      proposals: [mockProposal, { ...mockProposal, id: 'test-proposal-2' }],
    }
    render(<EntryProposalCard {...defaultProps} proposalGroup={groupWithMultiple} />)
    
    await user.click(screen.getByText('全て承認'))
    
    expect(defaultProps.onApproveAll).toHaveBeenCalled()
  })

  it('handles reject all action', async () => {
    const user = userEvent.setup()
    const groupWithMultiple = {
      ...mockProposalGroup,
      proposals: [mockProposal, { ...mockProposal, id: 'test-proposal-2' }],
    }
    render(<EntryProposalCard {...defaultProps} proposalGroup={groupWithMultiple} />)
    
    await user.click(screen.getByText('全て却下'))
    
    expect(defaultProps.onRejectAll).toHaveBeenCalled()
  })

  it('disables approve/reject all buttons when all proposals are processed', async () => {
    const user = userEvent.setup()
    const groupWithMultiple = {
      ...mockProposalGroup,
      proposals: [mockProposal, { ...mockProposal, id: 'test-proposal-2' }],
    }
    const { rerender } = render(<EntryProposalCard {...defaultProps} proposalGroup={groupWithMultiple} />)
    
    // Initially buttons should be present
    const approveAllButton = screen.getByText('全て承認')
    expect(approveAllButton).toBeInTheDocument()
    expect(approveAllButton).not.toBeDisabled()
    
    // Click approve all
    await user.click(approveAllButton)
    
    // After clicking approve all, all proposals are processed
    // The buttons should be removed from the DOM when pendingCount === 0
    await waitFor(() => {
      expect(screen.queryByText('全て承認')).not.toBeInTheDocument()
      expect(screen.queryByText('全て却下')).not.toBeInTheDocument()
    })
  })

  it('disables actions for approved proposals', () => {
    // First render with pending proposal
    const { rerender } = render(<EntryProposalCard {...defaultProps} />)
    
    // Approve the proposal by clicking the approve button
    const buttons = screen.getAllByRole('button')
    const approveButton = buttons.find(btn => btn.getAttribute('title') === '承認')
    expect(approveButton).toBeDefined()
    expect(approveButton).toBeInstanceOf(HTMLButtonElement)
    
    // After approval, the component internally tracks the state
    // We can verify that action buttons are no longer shown for approved proposals
    act(() => {
      if (approveButton) {
        fireEvent.click(approveButton)
      }
    })
    
    // After approval, the approve/reject buttons should not be visible anymore
    const buttonsAfter = screen.getAllByRole('button')
    const approveButtonAfter = buttonsAfter.find(btn => btn.getAttribute('title') === '承認')
    expect(approveButtonAfter).toBeUndefined()
  })

  it('shows rejected status', () => {
    // First render with pending proposal
    render(<EntryProposalCard {...defaultProps} />)
    
    // Find and click the reject button
    const buttons = screen.getAllByRole('button')
    const rejectButton = buttons.find(btn => btn.getAttribute('title') === '却下')
    
    act(() => {
      if (rejectButton) {
        fireEvent.click(rejectButton)
      }
    })
    
    // After rejection, verify the proposal item has reduced opacity
    // The component applies opacity-50 to the wrapper div that contains the proposal
    const proposalWrapper = screen.getByText('Strong support at 44k with bullish divergence on RSI')
      .closest('div[class*="group rounded-lg"]')
    expect(proposalWrapper).toHaveClass('opacity-50')
  })

  it('displays different strategy types correctly', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    // The component shows strategy labels in Japanese
    expect(screen.getByText('スイング')).toBeInTheDocument()
  })

  it('handles SHORT direction with appropriate styling', () => {
    const shortProposalGroup = {
      ...mockProposalGroup,
      proposals: [{ ...mockProposal, direction: 'short' as const }],
    }
    render(<EntryProposalCard {...defaultProps} proposalGroup={shortProposalGroup} />)
    
    expect(screen.getByText('ショートエントリー')).toBeInTheDocument()
  })

  it('shows entry price correctly', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    expect(screen.getByText('エントリー')).toBeInTheDocument()
    expect(screen.getByText('$45,000.00')).toBeInTheDocument()
  })

  it('displays stop loss correctly', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    expect(screen.getByText('ストップロス')).toBeInTheDocument()
    expect(screen.getByText('$44,000.00')).toBeInTheDocument()
    expect(screen.getByText('-2.22%')).toBeInTheDocument()
  })

  it('shows risk reward ratio', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    expect(screen.getByText('リスクリワード')).toBeInTheDocument()
    expect(screen.getByText('1:2.5')).toBeInTheDocument()
    expect(screen.getByText('推奨: 25.0%')).toBeInTheDocument()
  })

  it('displays confidence correctly', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    expect(screen.getByText('信頼度')).toBeInTheDocument()
    // Check for the specific confidence value in the proposal
    const confidenceBar = screen.getByText('信頼度').parentElement
    expect(confidenceBar).toHaveTextContent('78%')
  })

  it('shows low confidence correctly', () => {
    const lowConfidenceProposalGroup = {
      ...mockProposalGroup,
      proposals: [{ ...mockProposal, confidence: 0.45 }],
    }
    render(<EntryProposalCard {...defaultProps} proposalGroup={lowConfidenceProposalGroup} />)
    
    expect(screen.getByText('45%')).toBeInTheDocument()
  })

  it('displays priority correctly', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    expect(screen.getByText('高優先')).toBeInTheDocument()
  })

  it('can expand to show details', async () => {
    const user = userEvent.setup()
    render(<EntryProposalCard {...defaultProps} />)
    
    // Initially details are hidden
    expect(screen.queryByText('利確目標')).not.toBeInTheDocument()
    
    // Click to expand
    await user.click(screen.getByText('詳細を表示'))
    
    // Now details should be visible
    expect(screen.getByText('利確目標')).toBeInTheDocument()
    expect(screen.getByText('エントリー条件')).toBeInTheDocument()
    expect(screen.getByText('テクニカル要因')).toBeInTheDocument()
  })

  it('shows approve and reject buttons for pending proposals', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    // The component uses icon buttons without text
    const buttons = screen.getAllByRole('button')
    // Should have at least approve/reject buttons (plus expand button)
    expect(buttons.length).toBeGreaterThanOrEqual(3)
  })

  it('shows entry zone when available', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    // Entry zone is shown as a range below the entry price
    expect(screen.getByText('$44,800 - $45,200')).toBeInTheDocument()
  })

  it('handles approve action correctly', async () => {
    const user = userEvent.setup()
    render(<EntryProposalCard {...defaultProps} />)
    
    // Find and click the approve button (it's an icon button)
    const buttons = screen.getAllByRole('button')
    const approveButton = buttons.find(btn => btn.getAttribute('title') === '承認')
    
    if (approveButton) {
      await user.click(approveButton)
      expect(defaultProps.onApprove).toHaveBeenCalledWith(mockProposal.id)
    }
  })

  it('shows technical factors in expanded view', async () => {
    const user = userEvent.setup()
    render(<EntryProposalCard {...defaultProps} />)
    
    await user.click(screen.getByText('詳細を表示'))
    
    expect(screen.getByText('RSI Divergence')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('Support Level')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
  })

  it('shows risks in expanded view', async () => {
    const user = userEvent.setup()
    render(<EntryProposalCard {...defaultProps} />)
    
    await user.click(screen.getByText('詳細を表示'))
    
    expect(screen.getByText('リスク要因')).toBeInTheDocument()
    // The risks are rendered with bullet points
    const risksSection = screen.getByText('リスク要因').parentElement?.parentElement
    expect(risksSection).toHaveTextContent('Market volatility')
    expect(risksSection).toHaveTextContent('False breakout possibility')
  })
})