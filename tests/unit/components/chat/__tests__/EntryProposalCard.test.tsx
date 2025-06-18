import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EntryProposalCard } from '@/components/chat/EntryProposalCard'
import { EntryProposal } from '@/types/proposals'

const mockProposal: EntryProposal = {
  id: 'test-proposal-1',
  type: 'LIMIT',
  side: 'BUY',
  price: 45000,
  quantity: 0.5,
  symbol: 'BTCUSDT',
  stopLoss: 44000,
  takeProfit: 47000,
  reasoning: 'Strong support at 44k with bullish divergence on RSI',
  confidence: 78,
  riskReward: 2.5,
  timestamp: new Date('2024-01-03T10:00:00Z'),
  status: 'pending',
}

describe('EntryProposalCard', () => {
  const defaultProps = {
    proposal: mockProposal,
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onModify: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders proposal details correctly', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    expect(screen.getByText('BTCUSDT')).toBeInTheDocument()
    expect(screen.getByText('BUY')).toBeInTheDocument()
    expect(screen.getByText('LIMIT')).toBeInTheDocument()
    expect(screen.getByText('$45,000')).toBeInTheDocument()
    expect(screen.getByText('0.5')).toBeInTheDocument()
    expect(screen.getByText('78%')).toBeInTheDocument()
  })

  it('displays stop loss and take profit', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    expect(screen.getByText('Stop Loss:')).toBeInTheDocument()
    expect(screen.getByText('$44,000')).toBeInTheDocument()
    expect(screen.getByText('Take Profit:')).toBeInTheDocument()
    expect(screen.getByText('$47,000')).toBeInTheDocument()
  })

  it('shows risk/reward ratio', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    expect(screen.getByText('Risk/Reward:')).toBeInTheDocument()
    expect(screen.getByText('1:2.5')).toBeInTheDocument()
  })

  it('displays reasoning when expanded', async () => {
    const user = userEvent.setup()
    render(<EntryProposalCard {...defaultProps} />)
    
    // Reasoning should not be visible initially
    expect(screen.queryByText(mockProposal.reasoning)).not.toBeInTheDocument()
    
    // Click to expand
    await user.click(screen.getByRole('button', { name: /show reasoning/i }))
    
    expect(screen.getByText(mockProposal.reasoning)).toBeInTheDocument()
  })

  it('handles approve action', async () => {
    const user = userEvent.setup()
    render(<EntryProposalCard {...defaultProps} />)
    
    await user.click(screen.getByRole('button', { name: /approve/i }))
    
    expect(defaultProps.onApprove).toHaveBeenCalledWith(mockProposal.id)
  })

  it('handles reject action', async () => {
    const user = userEvent.setup()
    render(<EntryProposalCard {...defaultProps} />)
    
    await user.click(screen.getByRole('button', { name: /reject/i }))
    
    expect(defaultProps.onReject).toHaveBeenCalledWith(mockProposal.id)
  })

  it('shows modify button and handles click', async () => {
    const user = userEvent.setup()
    render(<EntryProposalCard {...defaultProps} />)
    
    await user.click(screen.getByRole('button', { name: /modify/i }))
    
    expect(defaultProps.onModify).toHaveBeenCalledWith(mockProposal)
  })

  it('disables actions for approved proposals', () => {
    const approvedProposal = { ...mockProposal, status: 'approved' as const }
    render(<EntryProposalCard {...defaultProps} proposal={approvedProposal} />)
    
    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /reject/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /modify/i })).toBeDisabled()
    
    // Should show approved status
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('shows rejected status', () => {
    const rejectedProposal = { ...mockProposal, status: 'rejected' as const }
    render(<EntryProposalCard {...defaultProps} proposal={rejectedProposal} />)
    
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('displays different order types correctly', () => {
    const { rerender } = render(<EntryProposalCard {...defaultProps} />)
    
    // LIMIT order
    expect(screen.getByText('LIMIT')).toBeInTheDocument()
    
    // MARKET order
    const marketProposal = { ...mockProposal, type: 'MARKET' as const, price: undefined }
    rerender(<EntryProposalCard {...defaultProps} proposal={marketProposal} />)
    expect(screen.getByText('MARKET')).toBeInTheDocument()
    expect(screen.getByText('Market Price')).toBeInTheDocument()
    
    // STOP order
    const stopProposal = { ...mockProposal, type: 'STOP' as const }
    rerender(<EntryProposalCard {...defaultProps} proposal={stopProposal} />)
    expect(screen.getByText('STOP')).toBeInTheDocument()
  })

  it('handles SELL side with appropriate styling', () => {
    const sellProposal = { ...mockProposal, side: 'SELL' as const }
    render(<EntryProposalCard {...defaultProps} proposal={sellProposal} />)
    
    const sideLabel = screen.getByText('SELL')
    expect(sideLabel).toHaveClass('text-red-600')
  })

  it('shows execution time if executed', () => {
    const executedProposal = {
      ...mockProposal,
      status: 'executed' as const,
      executedAt: new Date('2024-01-03T10:05:00Z'),
      executedPrice: 44950,
    }
    
    render(<EntryProposalCard {...defaultProps} proposal={executedProposal} />)
    
    expect(screen.getByText('Executed')).toBeInTheDocument()
    expect(screen.getByText('Executed Price:')).toBeInTheDocument()
    expect(screen.getByText('$44,950')).toBeInTheDocument()
  })

  it('calculates and displays position value', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    // Position value = price * quantity = 45000 * 0.5 = 22500
    expect(screen.getByText('Position Value:')).toBeInTheDocument()
    expect(screen.getByText('$22,500')).toBeInTheDocument()
  })

  it('shows risk amount and percentage', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    // Risk = (price - stopLoss) * quantity = (45000 - 44000) * 0.5 = 500
    expect(screen.getByText('Risk:')).toBeInTheDocument()
    expect(screen.getByText('$500')).toBeInTheDocument()
    expect(screen.getByText('(2.22%)')).toBeInTheDocument()
  })

  it('highlights high confidence proposals', () => {
    const highConfidenceProposal = { ...mockProposal, confidence: 92 }
    render(<EntryProposalCard {...defaultProps} proposal={highConfidenceProposal} />)
    
    const confidenceBadge = screen.getByText('92%')
    expect(confidenceBadge).toHaveClass('text-green-600')
    expect(confidenceBadge.parentElement).toHaveClass('ring-green-500')
  })

  it('shows warning for low confidence', () => {
    const lowConfidenceProposal = { ...mockProposal, confidence: 45 }
    render(<EntryProposalCard {...defaultProps} proposal={lowConfidenceProposal} />)
    
    expect(screen.getByText('45%')).toHaveClass('text-red-600')
    expect(screen.getByText(/low confidence/i)).toBeInTheDocument()
  })

  it('displays time since proposal', () => {
    render(<EntryProposalCard {...defaultProps} />)
    
    // Should show relative time
    expect(screen.getByText(/ago$/)).toBeInTheDocument()
  })

  it('handles proposals without stop loss or take profit', () => {
    const minimalProposal = {
      ...mockProposal,
      stopLoss: undefined,
      takeProfit: undefined,
    }
    
    render(<EntryProposalCard {...defaultProps} proposal={minimalProposal} />)
    
    expect(screen.queryByText('Stop Loss:')).not.toBeInTheDocument()
    expect(screen.queryByText('Take Profit:')).not.toBeInTheDocument()
    expect(screen.queryByText('Risk/Reward:')).not.toBeInTheDocument()
  })

  it('shows loading state when processing', () => {
    render(<EntryProposalCard {...defaultProps} isProcessing />)
    
    const approveButton = screen.getByRole('button', { name: /approve/i })
    const rejectButton = screen.getByRole('button', { name: /reject/i })
    
    expect(approveButton).toBeDisabled()
    expect(rejectButton).toBeDisabled()
    expect(screen.getByTestId('processing-spinner')).toBeInTheDocument()
  })

  it('supports compact mode', () => {
    render(<EntryProposalCard {...defaultProps} compact />)
    
    // In compact mode, should hide some details
    expect(screen.queryByText(/reasoning/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Position Value:')).not.toBeInTheDocument()
    
    // But should still show key info
    expect(screen.getByText('BTCUSDT')).toBeInTheDocument()
    expect(screen.getByText('$45,000')).toBeInTheDocument()
  })

  it('handles keyboard shortcuts', async () => {
    const user = userEvent.setup()
    render(<EntryProposalCard {...defaultProps} />)
    
    // Focus on card
    const card = screen.getByRole('article')
    card.focus()
    
    // Press 'a' to approve
    await user.keyboard('a')
    expect(defaultProps.onApprove).toHaveBeenCalled()
    
    // Press 'r' to reject
    await user.keyboard('r')
    expect(defaultProps.onReject).toHaveBeenCalled()
    
    // Press 'm' to modify
    await user.keyboard('m')
    expect(defaultProps.onModify).toHaveBeenCalled()
  })

  it('shows comparison with current market price', () => {
    render(<EntryProposalCard {...defaultProps} currentPrice={45500} />)
    
    // Proposal price is 45000, current is 45500
    expect(screen.getByText('Below Market')).toBeInTheDocument()
    expect(screen.getByText('-1.10%')).toBeInTheDocument()
  })

  it('displays additional metadata if available', () => {
    const proposalWithMetadata = {
      ...mockProposal,
      metadata: {
        pattern: 'Bull Flag',
        indicators: ['RSI', 'MACD'],
        timeframe: '4H',
      },
    }
    
    render(<EntryProposalCard {...defaultProps} proposal={proposalWithMetadata} />)
    
    expect(screen.getByText('Bull Flag')).toBeInTheDocument()
    expect(screen.getByText('4H')).toBeInTheDocument()
    expect(screen.getByText('RSI, MACD')).toBeInTheDocument()
  })
})