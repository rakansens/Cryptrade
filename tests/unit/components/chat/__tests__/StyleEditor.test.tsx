/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StyleEditor } from '@/components/chat/StyleEditor'
import { showToast } from '@/components/ui/toast'
import { logger } from '@/lib/utils/logger'

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

jest.mock('@/components/ui/toast', () => ({
  showToast: jest.fn(),
}))

// All UI components are mocked via __mocks__ directory

describe('StyleEditor', () => {
  const defaultProps = {
    drawingId: 'test-drawing-123',
    proposalId: 'test-proposal-456',
    currentStyle: {
      color: '#22c55e',
      lineWidth: 2,
      lineStyle: 'solid' as const,
      showLabels: true,
    },
    isPattern: false,
    onStyleChange: jest.fn(),
    onPatternStyleChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Clear any window event listeners
    window.dispatchEvent = jest.fn()
    // Ensure showToast is mocked
    const toast = require('@/components/ui/toast');
    toast.showToast = jest.fn();
  })

  it('renders the style editor button', () => {
    render(<StyleEditor {...defaultProps} />)
    
    expect(screen.getByTestId('popover-trigger')).toBeInTheDocument()
    expect(screen.getByText('スタイル')).toBeInTheDocument()
  })

  it('opens popover when clicked', () => {
    render(<StyleEditor {...defaultProps} />)
    
    const trigger = screen.getByTestId('popover-trigger')
    fireEvent.click(trigger)
    
    expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'true')
  })

  it('shows all tabs for regular drawings', () => {
    render(<StyleEditor {...defaultProps} />)
    
    fireEvent.click(screen.getByTestId('popover-trigger'))
    
    expect(screen.getByTestId('tab-basic')).toBeInTheDocument()
    expect(screen.getByTestId('tab-presets')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-pattern')).not.toBeInTheDocument()
  })

  it('shows pattern tab for pattern drawings', () => {
    render(<StyleEditor {...defaultProps} isPattern={true} patternType="head_and_shoulders" />)
    
    fireEvent.click(screen.getByTestId('popover-trigger'))
    
    expect(screen.getByTestId('tab-pattern')).toBeInTheDocument()
  })

  describe('Basic tab functionality', () => {
    it('handles color change', async () => {
      render(<StyleEditor {...defaultProps} />)
      
      const trigger = screen.getByTestId('popover-trigger')
      fireEvent.click(trigger)
      
      // Wait for popover to open
      await waitFor(() => {
        expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'true')
      })
      
      // Find color input
      const colorInput = screen.getByPlaceholderText('#22c55e')
      fireEvent.change(colorInput, { target: { value: '#3b82f6' } })
      
      await waitFor(() => {
        expect(window.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:updateDrawingStyle',
            detail: expect.objectContaining({
              drawingId: 'test-drawing-123',
              style: expect.objectContaining({ color: '#3b82f6' }),
              immediate: true,
            }),
          })
        )
      })
      
      expect(defaultProps.onStyleChange).toHaveBeenCalledWith({ color: '#3b82f6' })
    })

    it('validates hex color format', async () => {
      render(<StyleEditor {...defaultProps} />)
      
      const trigger = screen.getByTestId('popover-trigger')
      fireEvent.click(trigger)
      
      // Wait for popover to open
      await waitFor(() => {
        expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'true')
      })
      
      const colorInput = screen.getByPlaceholderText('#22c55e')
      fireEvent.change(colorInput, { target: { value: 'invalid-color' } })
      
      await waitFor(() => {
        expect(window.dispatchEvent).not.toHaveBeenCalled()
      })
    })

    it('handles line width change', async () => {
      render(<StyleEditor {...defaultProps} />)
      
      const trigger = screen.getByTestId('popover-trigger')
      fireEvent.click(trigger)
      
      // Wait for popover to open
      await waitFor(() => {
        expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'true')
      })
      
      const rangeInput = screen.getByRole('slider')
      fireEvent.change(rangeInput, { target: { value: '5' } })
      
      await waitFor(() => {
        expect(window.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:updateDrawingStyle',
            detail: expect.objectContaining({
              style: expect.objectContaining({ lineWidth: 5 }),
            }),
          })
        )
      })
    })

    it('handles line style change', async () => {
      render(<StyleEditor {...defaultProps} />)
      
      const trigger = screen.getByTestId('popover-trigger')
      fireEvent.click(trigger)
      
      // Wait for popover to open
      await waitFor(() => {
        expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'true')
      })
      
      // Find the dashed line button by looking for the SVG pattern
      const buttons = screen.getAllByRole('button')
      const dashedButton = buttons.find(button => {
        // Look for the button containing dashed line SVG
        const svg = button.querySelector('svg')
        if (svg) {
          const line = svg.querySelector('line')
          return line?.getAttribute('stroke-dasharray') === '4 2'
        }
        return false
      })
      
      expect(dashedButton).toBeTruthy()
      fireEvent.click(dashedButton!)
      
      await waitFor(() => {
        expect(window.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:updateDrawingStyle',
            detail: expect.objectContaining({
              style: expect.objectContaining({ lineStyle: 'dashed' }),
            }),
          })
        )
      })
    })

    it('handles show labels toggle', async () => {
      render(<StyleEditor {...defaultProps} />)
      
      const trigger = screen.getByTestId('popover-trigger')
      fireEvent.click(trigger)
      
      // Wait for popover to open
      await waitFor(() => {
        expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'true')
      })
      
      // Find the show labels toggle button
      const labelText = screen.getByText('価格ラベルを表示')
      const toggleButton = labelText.parentElement?.querySelector('button')
      
      expect(toggleButton).toBeTruthy()
      fireEvent.click(toggleButton!)
      
      await waitFor(() => {
        expect(window.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:updateDrawingStyle',
            detail: expect.objectContaining({
              style: expect.objectContaining({ showLabels: false }),
            }),
          })
        )
      })
    })
  })

  describe('Presets functionality', () => {
    it('applies preset style', async () => {
      render(<StyleEditor {...defaultProps} />)
      
      const trigger = screen.getByTestId('popover-trigger')
      fireEvent.click(trigger)
      
      // Wait for popover to open
      await waitFor(() => {
        expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'true')
      })
      fireEvent.click(screen.getByTestId('tab-presets'))
      
      // Click on professional preset
      const professionalPreset = screen.getByText('プロフェッショナル')
      fireEvent.click(professionalPreset.closest('button')!)
      
      await waitFor(() => {
        expect(window.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:updateDrawingStyle',
            detail: expect.objectContaining({
              style: expect.objectContaining({
                color: '#3b82f6',
                lineWidth: 2,
                lineStyle: 'solid',
              }),
            }),
          })
        )
      })
      
      expect(showToast).toHaveBeenCalledWith('プリセット「プロフェッショナル」を適用しました', 'success')
    })
  })

  describe('Pattern functionality', () => {
    it('handles pattern fill opacity change', async () => {
      const patternProps = {
        ...defaultProps,
        isPattern: true,
        patternType: 'head_and_shoulders',
      }
      
      render(<StyleEditor {...patternProps} />)
      
      const trigger = screen.getByTestId('popover-trigger')
      fireEvent.click(trigger)
      
      // Wait for popover to open
      await waitFor(() => {
        expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'true')
      })
      fireEvent.click(screen.getByTestId('tab-pattern'))
      
      const opacitySlider = screen.getAllByRole('slider')[0]
      fireEvent.change(opacitySlider!, { target: { value: '0.5' } })
      
      await waitFor(() => {
        expect(window.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:updatePatternStyle',
            detail: expect.objectContaining({
              patternId: 'test-drawing-123',
              patternStyle: expect.objectContaining({ patternFillOpacity: 0.5 }),
              immediate: true,
            }),
          })
        )
      })
      
      expect(patternProps.onPatternStyleChange).toHaveBeenCalledWith({ patternFillOpacity: 0.5 })
    })

    it('handles metric label position change', async () => {
      const patternProps = {
        ...defaultProps,
        isPattern: true,
        patternType: 'double_top',
      }
      
      render(<StyleEditor {...patternProps} />)
      
      const trigger = screen.getByTestId('popover-trigger')
      fireEvent.click(trigger)
      
      // Wait for popover to open
      await waitFor(() => {
        expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'true')
      })
      fireEvent.click(screen.getByTestId('tab-pattern'))
      
      // Find metric label position buttons
      const leftButton = screen.getByText('左')
      fireEvent.click(leftButton)
      
      await waitFor(() => {
        expect(window.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:updatePatternStyle',
            detail: expect.objectContaining({
              patternStyle: expect.objectContaining({ metricLabelPosition: 'left' }),
            }),
          })
        )
      })
    })
  })

  describe('Error handling', () => {
    it('shows error toast on validation failure', async () => {
      // Mock validation to throw error
      const mockError = new Error('Validation failed')
      jest.spyOn(console, 'error').mockImplementation(() => {})
      
      render(<StyleEditor {...defaultProps} />)
      
      const trigger = screen.getByTestId('popover-trigger')
      fireEvent.click(trigger)
      
      // Wait for popover to open
      await waitFor(() => {
        expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'true')
      })
      
      // Force an error by manipulating the event dispatch
      const originalDispatch = window.dispatchEvent;
      (window.dispatchEvent as jest.Mock).mockImplementation(() => {
        throw mockError
      })
      
      const colorInput = screen.getByPlaceholderText('#22c55e')
      fireEvent.change(colorInput, { target: { value: '#3b82f6' } })
      
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          '[StyleEditor] Failed to validate style update',
          expect.objectContaining({ error: mockError })
        )
      })
      
      expect(showToast).toHaveBeenCalledWith('スタイルの更新に失敗しました', 'error')
      
      // Restore original dispatch
      window.dispatchEvent = originalDispatch
    })
  })
})
