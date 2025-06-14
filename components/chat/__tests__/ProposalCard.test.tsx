import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProposalCard } from '../ProposalCard'
import type { ProposalGroup, DrawingProposal } from '@/types/proposal'

// Mock the StyleEditor component
jest.mock('../StyleEditor', () => ({
  StyleEditor: ({ drawingId, proposalId }: any) => (
    <div data-testid={`style-editor-${proposalId}`}>StyleEditor for {drawingId}</div>
  )
}))

describe('ProposalCard', () => {
  const mockProposal: DrawingProposal = {
    id: 'proposal-1',
    title: '上昇トレンドライン',
    description: '強い上昇トレンドを示すライン',
    priority: 'high',
    confidence: 0.85,
    reason: '複数のサポートポイントで反発',
    touches: 5,
    drawingData: {
      type: 'trendline',
      points: [
        { time: 1704067200, value: 45000 },
        { time: 1704153600, value: 47000 }
      ],
      style: {
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: 'solid',
        showLabels: false
      }
    }
  }

  const mockProposalGroup: ProposalGroup = {
    id: 'group-1',
    title: 'トレンドライン分析',
    description: '現在の市場トレンドに基づく提案',
    proposals: [mockProposal],
    timestamp: Date.now()
  }

  const defaultProps = {
    proposalGroup: mockProposalGroup,
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onApproveAll: jest.fn(),
    onRejectAll: jest.fn(),
    onCancel: jest.fn(),
    approvedDrawingIds: new Map()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders proposal card with correct title and description', () => {
      render(<ProposalCard {...defaultProps} />)
      
      expect(screen.getByText('トレンドライン分析')).toBeInTheDocument()
      expect(screen.getByText('現在の市場トレンドに基づく提案')).toBeInTheDocument()
    })

    it('renders individual proposal with details', () => {
      render(<ProposalCard {...defaultProps} />)
      
      expect(screen.getByText('上昇トレンドライン')).toBeInTheDocument()
      expect(screen.getByText('強い上昇トレンドを示すライン')).toBeInTheDocument()
      expect(screen.getByText('複数のサポートポイントで反発')).toBeInTheDocument()
    })

    it('displays confidence percentage correctly', () => {
      render(<ProposalCard {...defaultProps} />)
      
      expect(screen.getByText('85%')).toBeInTheDocument()
    })

    it('displays touch count when available', () => {
      render(<ProposalCard {...defaultProps} />)
      
      expect(screen.getByText('5回')).toBeInTheDocument()
    })

    it('shows price range for trendline', () => {
      render(<ProposalCard {...defaultProps} />)
      
      expect(screen.getByText(/\$45,000.*→.*\$47,000/)).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('renders empty state when no proposals', () => {
      const emptyProps = {
        ...defaultProps,
        proposalGroup: {
          ...mockProposalGroup,
          proposals: []
        }
      }
      
      render(<ProposalCard {...emptyProps} />)
      
      expect(screen.getByText(/現在の市場状況では、明確なトレンドラインを検出できませんでした/)).toBeInTheDocument()
    })
  })

  describe('Interaction Handling', () => {
    it('calls onApprove when approve button is clicked', async () => {
      render(<ProposalCard {...defaultProps} />)
      
      const approveButton = screen.getByTitle('承認')
      fireEvent.click(approveButton)
      
      await waitFor(() => {
        expect(defaultProps.onApprove).toHaveBeenCalledWith('proposal-1')
      })
    })

    it('calls onReject when reject button is clicked', async () => {
      render(<ProposalCard {...defaultProps} />)
      
      const rejectButton = screen.getByTitle('却下')
      fireEvent.click(rejectButton)
      
      await waitFor(() => {
        expect(defaultProps.onReject).toHaveBeenCalledWith('proposal-1')
      })
    })

    it('calls onApproveAll when approve all button is clicked', async () => {
      const multipleProposals = {
        ...defaultProps,
        proposalGroup: {
          ...mockProposalGroup,
          proposals: [
            mockProposal,
            { ...mockProposal, id: 'proposal-2', title: '下降トレンドライン' }
          ]
        }
      }
      
      render(<ProposalCard {...multipleProposals} />)
      
      const approveAllButton = screen.getByText('全て承認')
      fireEvent.click(approveAllButton)
      
      await waitFor(() => {
        expect(defaultProps.onApproveAll).toHaveBeenCalled()
      })
    })

    it('calls onRejectAll when reject all button is clicked', async () => {
      const multipleProposals = {
        ...defaultProps,
        proposalGroup: {
          ...mockProposalGroup,
          proposals: [
            mockProposal,
            { ...mockProposal, id: 'proposal-2', title: '下降トレンドライン' }
          ]
        }
      }
      
      render(<ProposalCard {...multipleProposals} />)
      
      const rejectAllButton = screen.getByText('全て却下')
      fireEvent.click(rejectAllButton)
      
      await waitFor(() => {
        expect(defaultProps.onRejectAll).toHaveBeenCalled()
      })
    })
  })

  describe('Status Management', () => {
    it('shows approved status when proposal is approved', () => {
      render(<ProposalCard {...defaultProps} />)
      
      const approveButton = screen.getByTitle('承認')
      fireEvent.click(approveButton)
      
      expect(screen.getByText('承認済み')).toBeInTheDocument()
    })

    it('shows rejected status when proposal is rejected', () => {
      render(<ProposalCard {...defaultProps} />)
      
      const rejectButton = screen.getByTitle('却下')
      fireEvent.click(rejectButton)
      
      expect(screen.getByText('却下済み')).toBeInTheDocument()
    })

    it('hides action buttons for approved proposals', () => {
      render(<ProposalCard {...defaultProps} />)
      
      const approveButton = screen.getByTitle('承認')
      fireEvent.click(approveButton)
      
      expect(screen.queryByTitle('承認')).not.toBeInTheDocument()
      expect(screen.queryByTitle('却下')).not.toBeInTheDocument()
    })

    it('shows cancel button for approved proposals with drawing id', () => {
      const propsWithDrawingId = {
        ...defaultProps,
        approvedDrawingIds: new Map([['proposal-1', 'drawing-1']])
      }
      
      render(<ProposalCard {...propsWithDrawingId} />)
      
      const approveButton = screen.getByTitle('承認')
      fireEvent.click(approveButton)
      
      expect(screen.getByText('取り消し')).toBeInTheDocument()
    })

    it('calls onCancel when cancel button is clicked', async () => {
      const propsWithDrawingId = {
        ...defaultProps,
        approvedDrawingIds: new Map([['proposal-1', 'drawing-1']])
      }
      
      render(<ProposalCard {...propsWithDrawingId} />)
      
      const approveButton = screen.getByTitle('承認')
      fireEvent.click(approveButton)
      
      const cancelButton = screen.getByText('取り消し')
      fireEvent.click(cancelButton)
      
      await waitFor(() => {
        expect(defaultProps.onCancel).toHaveBeenCalledWith('drawing-1')
      })
    })
  })

  describe('Different Drawing Types', () => {
    it('renders horizontal line with price level', () => {
      const horizontalProposal = {
        ...defaultProps,
        proposalGroup: {
          ...mockProposalGroup,
          proposals: [{
            ...mockProposal,
            drawingData: {
              type: 'horizontal' as const,
              points: [{ time: 1704067200, value: 50000 }],
              price: 50000,
              style: mockProposal.drawingData.style
            }
          }]
        }
      }
      
      render(<ProposalCard {...horizontalProposal} />)
      
      expect(screen.getByText('価格レベル')).toBeInTheDocument()
      expect(screen.getByText('$50,000')).toBeInTheDocument()
    })

    it('renders fibonacci with levels', () => {
      const fibonacciProposal = {
        ...defaultProps,
        proposalGroup: {
          ...mockProposalGroup,
          proposals: [{
            ...mockProposal,
            drawingData: {
              type: 'fibonacci' as const,
              points: [
                { time: 1704067200, value: 45000 },
                { time: 1704153600, value: 50000 }
              ],
              levels: [0.236, 0.382, 0.5, 0.618],
              style: mockProposal.drawingData.style
            }
          }]
        }
      }
      
      render(<ProposalCard {...fibonacciProposal} />)
      
      expect(screen.getByText(/レベル:.*23.6%.*38.2%.*50.0%.*61.8%/)).toBeInTheDocument()
    })

    it('renders pattern with metrics', () => {
      const patternProposal = {
        ...defaultProps,
        proposalGroup: {
          ...mockProposalGroup,
          proposals: [{
            ...mockProposal,
            drawingData: {
              type: 'pattern' as const,
              points: mockProposal.drawingData.points,
              style: mockProposal.drawingData.style,
              metadata: {
                patternType: 'head-and-shoulders',
                metrics: {
                  breakout_level: 48000,
                  target_level: 52000,
                  stop_loss: 46000
                },
                tradingImplication: 'bullish' as const
              }
            }
          }]
        }
      }
      
      render(<ProposalCard {...patternProposal} />)
      
      expect(screen.getByText('ブレイクアウト')).toBeInTheDocument()
      expect(screen.getByText('$48,000')).toBeInTheDocument()
      expect(screen.getByText('目標価格')).toBeInTheDocument()
      expect(screen.getByText('$52,000')).toBeInTheDocument()
      expect(screen.getByText('ストップロス')).toBeInTheDocument()
      expect(screen.getByText('$46,000')).toBeInTheDocument()
      expect(screen.getByText('上昇')).toBeInTheDocument()
    })
  })

  describe('Priority and Status Indicators', () => {
    it('displays high priority indicator correctly', () => {
      render(<ProposalCard {...defaultProps} />)
      
      const priorityIndicator = screen.getByText('高')
      expect(priorityIndicator).toHaveClass('text-[hsl(var(--color-loss))]')
    })

    it('displays medium priority indicator correctly', () => {
      const mediumPriorityProps = {
        ...defaultProps,
        proposalGroup: {
          ...mockProposalGroup,
          proposals: [{
            ...mockProposal,
            priority: 'medium' as const
          }]
        }
      }
      
      render(<ProposalCard {...mediumPriorityProps} />)
      
      const priorityIndicator = screen.getByText('中')
      expect(priorityIndicator).toHaveClass('text-[hsl(var(--color-warning))]')
    })

    it('displays low priority indicator correctly', () => {
      const lowPriorityProps = {
        ...defaultProps,
        proposalGroup: {
          ...mockProposalGroup,
          proposals: [{
            ...mockProposal,
            priority: 'low' as const
          }]
        }
      }
      
      render(<ProposalCard {...lowPriorityProps} />)
      
      const priorityIndicator = screen.getByText('低')
      expect(priorityIndicator).toHaveClass('text-[hsl(var(--color-profit))]')
    })
  })

  describe('Footer Statistics', () => {
    it('displays correct counts for multiple proposals', () => {
      const multipleProposals = {
        ...defaultProps,
        proposalGroup: {
          ...mockProposalGroup,
          proposals: [
            mockProposal,
            { ...mockProposal, id: 'proposal-2' },
            { ...mockProposal, id: 'proposal-3' }
          ]
        }
      }
      
      render(<ProposalCard {...multipleProposals} />)
      
      expect(screen.getByText('3件の提案待ち')).toBeInTheDocument()
      
      // Approve one
      const approveButtons = screen.getAllByTitle('承認')
      fireEvent.click(approveButtons[0])
      
      expect(screen.getByText(/2件の提案待ち.*1件承認済み/)).toBeInTheDocument()
      
      // Reject one
      const rejectButtons = screen.getAllByTitle('却下')
      fireEvent.click(rejectButtons[0])
      
      expect(screen.getByText(/1件の提案待ち.*1件承認済み.*1件却下/)).toBeInTheDocument()
    })
  })

  describe('StyleEditor Integration', () => {
    it('renders StyleEditor for approved proposals with drawing id', () => {
      const propsWithDrawingId = {
        ...defaultProps,
        approvedDrawingIds: new Map([['proposal-1', 'drawing-1']])
      }
      
      render(<ProposalCard {...propsWithDrawingId} />)
      
      const approveButton = screen.getByTitle('承認')
      fireEvent.click(approveButton)
      
      expect(screen.getByTestId('style-editor-proposal-1')).toBeInTheDocument()
    })
  })
})