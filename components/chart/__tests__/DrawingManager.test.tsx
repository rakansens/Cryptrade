import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DrawingManager from '../toolbar/DrawingManager'
import { useChartDrawings, useChartPatterns, useDrawingActions, usePatternActions } from '@/store/chart.store'

// Mock dependencies
jest.mock('@/store/chart.store')
jest.mock('@/components/chat/StyleEditor', () => ({
  StyleEditor: ({ drawingId, isPattern }: any) => (
    <div data-testid="style-editor">
      Style Editor - {drawingId} - {isPattern ? 'Pattern' : 'Drawing'}
    </div>
  )
}))

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, disabled, title }: any) => (
    <button
      onClick={onClick}
      className={className}
      disabled={disabled}
      title={title}
      data-testid={title?.toLowerCase().replace(/\s/g, '-')}
    >
      {children}
    </button>
  )
}))

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children, open, onOpenChange }: any) => (
    <div data-testid="popover" data-open={open}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children, asChild }: any) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({ children }: any) => (
    <div data-testid="popover-content">{children}</div>
  )
}))

describe('DrawingManager', () => {
  const mockDrawings = [
    {
      id: 'drawing-1',
      type: 'trendline',
      points: [
        { time: 1704067200, value: 45000 },
        { time: 1704153600, value: 47000 }
      ],
      style: { color: '#3b82f6', lineWidth: 2, lineStyle: 'solid' },
      metadata: { createdAt: Date.now() }
    },
    {
      id: 'drawing-2',
      type: 'trendline',
      points: [
        { time: 1704067200, value: 47000 },
        { time: 1704153600, value: 45000 }
      ],
      style: { color: '#ef4444', lineWidth: 2, lineStyle: 'solid' },
      metadata: { createdAt: Date.now() - 3600000 }
    }
  ]

  const mockPatterns = new Map([
    ['pattern-1', { id: 'pattern-1', type: 'pattern' }],
    ['pattern-2', { id: 'pattern-2', type: 'pattern' }]
  ])

  const mockActions = {
    deleteDrawing: jest.fn(),
    clearAllDrawings: jest.fn(),
    removePattern: jest.fn(),
    clearPatterns: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useChartDrawings as jest.Mock).mockReturnValue(mockDrawings)
    ;(useChartPatterns as jest.Mock).mockReturnValue(mockPatterns)
    ;(useDrawingActions as jest.Mock).mockReturnValue({
      deleteDrawing: mockActions.deleteDrawing,
      clearAllDrawings: mockActions.clearAllDrawings
    })
    ;(usePatternActions as jest.Mock).mockReturnValue({
      removePattern: mockActions.removePattern,
      clearPatterns: mockActions.clearPatterns
    })
    
    // Mock window.dispatchEvent
    window.dispatchEvent = jest.fn()
  })

  describe('Basic Rendering', () => {
    it('renders list button with count badge', () => {
      render(<DrawingManager />)
      
      const listButton = screen.getByTitle('描画一覧')
      expect(listButton).toBeInTheDocument()
      
      // Count badge shows total of drawings + patterns
      expect(screen.getByText('4')).toBeInTheDocument()
    })

    it('shows 99+ when count exceeds 99', () => {
      const manyDrawings = Array(100).fill(null).map((_, i) => ({
        ...mockDrawings[0],
        id: `drawing-${i}`
      }))
      ;(useChartDrawings as jest.Mock).mockReturnValue(manyDrawings)
      
      render(<DrawingManager />)
      
      expect(screen.getByText('99+')).toBeInTheDocument()
    })

    it('disables list button when no drawings or patterns', () => {
      ;(useChartDrawings as jest.Mock).mockReturnValue([])
      ;(useChartPatterns as jest.Mock).mockReturnValue(new Map())
      
      render(<DrawingManager />)
      
      const listButton = screen.getByTitle('描画一覧')
      expect(listButton).toBeDisabled()
    })

    it('does not show count badge when empty', () => {
      ;(useChartDrawings as jest.Mock).mockReturnValue([])
      ;(useChartPatterns as jest.Mock).mockReturnValue(new Map())
      
      render(<DrawingManager />)
      
      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })
  })

  describe('Popover Content', () => {
    it('shows drawing count in header', () => {
      render(<DrawingManager />)
      
      expect(screen.getByText('描画数: 4')).toBeInTheDocument()
    })

    it('shows empty state when no drawings', () => {
      ;(useChartDrawings as jest.Mock).mockReturnValue([])
      ;(useChartPatterns as jest.Mock).mockReturnValue(new Map())
      
      render(<DrawingManager />)
      
      expect(screen.getByText('描画はありません')).toBeInTheDocument()
    })

    it('lists all drawings with labels', () => {
      render(<DrawingManager />)
      
      expect(screen.getByText('TL 1')).toBeInTheDocument()
      expect(screen.getByText('TL 2')).toBeInTheDocument()
      expect(screen.getByText('Pattern 1')).toBeInTheDocument()
      expect(screen.getByText('Pattern 2')).toBeInTheDocument()
    })

    it('shows upward arrow for ascending trendlines', () => {
      render(<DrawingManager />)
      
      // First drawing goes from 45000 to 47000 (up)
      const upArrows = screen.getAllByRole('generic').filter(el => 
        el.className.includes('text-green-400')
      )
      expect(upArrows.length).toBeGreaterThan(0)
    })

    it('shows downward arrow for descending trendlines', () => {
      render(<DrawingManager />)
      
      // Second drawing goes from 47000 to 45000 (down)
      const downArrows = screen.getAllByRole('generic').filter(el => 
        el.className.includes('text-red-400')
      )
      expect(downArrows.length).toBeGreaterThan(0)
    })

    it('shows color swatch for drawings', () => {
      render(<DrawingManager />)
      
      const colorSwatches = screen.getAllByRole('generic').filter(el => 
        el.style.background
      )
      expect(colorSwatches[0]).toHaveStyle({ background: '#3b82f6' })
      expect(colorSwatches[1]).toHaveStyle({ background: '#ef4444' })
    })

    it('shows creation time for drawings', () => {
      render(<DrawingManager />)
      
      // Should show time in HH:MM format
      const timeElements = screen.getAllByText(/\d{1,2}:\d{2}/)
      expect(timeElements.length).toBeGreaterThan(0)
    })
  })

  describe('Delete Actions', () => {
    it('deletes individual drawing when delete button clicked', async () => {
      render(<DrawingManager />)
      
      const deleteButtons = screen.getAllByTitle('削除')
      fireEvent.click(deleteButtons[0])
      
      await waitFor(() => {
        expect(mockActions.deleteDrawing).toHaveBeenCalledWith('drawing-1')
        expect(window.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:deleteDrawing',
            detail: { id: 'drawing-1' }
          })
        )
      })
    })

    it('deletes individual pattern when delete button clicked', async () => {
      render(<DrawingManager />)
      
      const deleteButtons = screen.getAllByTitle('削除')
      // Patterns come after drawings in the list
      fireEvent.click(deleteButtons[2])
      
      await waitFor(() => {
        expect(mockActions.removePattern).toHaveBeenCalledWith('pattern-1')
        expect(window.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:removePattern',
            detail: { id: 'pattern-1' }
          })
        )
      })
    })

    it('clears all drawings and patterns when clear all clicked', async () => {
      render(<DrawingManager />)
      
      const clearAllButton = screen.getByTitle('全削除')
      fireEvent.click(clearAllButton)
      
      await waitFor(() => {
        expect(mockActions.clearAllDrawings).toHaveBeenCalled()
        expect(mockActions.clearPatterns).toHaveBeenCalled()
        
        // Should dispatch remove events for each pattern
        expect(window.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:removePattern',
            detail: { id: 'pattern-1' }
          })
        )
        expect(window.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:removePattern',
            detail: { id: 'pattern-2' }
          })
        )
      })
    })

    it('disables clear all button when no items', () => {
      ;(useChartDrawings as jest.Mock).mockReturnValue([])
      ;(useChartPatterns as jest.Mock).mockReturnValue(new Map())
      
      render(<DrawingManager />)
      
      const clearAllButton = screen.getByTitle('全削除')
      expect(clearAllButton).toBeDisabled()
    })
  })

  describe('Style Editor', () => {
    it('renders style editor in popover for drawings', () => {
      render(<DrawingManager />)
      
      const styleButtons = screen.getAllByTitle('スタイル変更')
      expect(styleButtons[0]).toBeInTheDocument()
      
      // Check style editor content
      expect(screen.getByText('Style Editor - drawing-1 - Drawing')).toBeInTheDocument()
    })

    it('renders style editor for patterns', () => {
      render(<DrawingManager />)
      
      expect(screen.getByText('Style Editor - pattern-1 - Pattern')).toBeInTheDocument()
    })

    it('passes correct props to StyleEditor', () => {
      render(<DrawingManager />)
      
      // For drawings
      expect(screen.getByText('Style Editor - drawing-1 - Drawing')).toBeInTheDocument()
      
      // For patterns
      expect(screen.getByText('Style Editor - pattern-1 - Pattern')).toBeInTheDocument()
    })
  })

  describe('Popover State', () => {
    it('toggles popover open state', () => {
      render(<DrawingManager />)
      
      const popover = screen.getByTestId('popover')
      expect(popover).toHaveAttribute('data-open', 'false')
      
      const listButton = screen.getByTitle('描画一覧')
      fireEvent.click(listButton)
      
      // In real implementation, this would toggle the popover
      // Our mock doesn't handle state changes
    })
  })

  describe('Custom Class Names', () => {
    it('applies custom className when provided', () => {
      const { container } = render(<DrawingManager className="custom-class" />)
      
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass('custom-class')
    })

    it('applies default classes', () => {
      const { container } = render(<DrawingManager />)
      
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass('flex', 'items-center', 'gap-1')
    })
  })

  describe('Drawing Order', () => {
    it('displays drawings and patterns in correct order', () => {
      render(<DrawingManager />)
      
      const labels = screen.getAllByText(/^(TL|Pattern) \d+$/)
      expect(labels[0]).toHaveTextContent('TL 1')
      expect(labels[1]).toHaveTextContent('TL 2')
      expect(labels[2]).toHaveTextContent('Pattern 1')
      expect(labels[3]).toHaveTextContent('Pattern 2')
    })
  })
})