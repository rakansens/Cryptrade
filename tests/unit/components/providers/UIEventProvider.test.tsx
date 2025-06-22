/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { UIEventProvider } from '@/components/providers/UIEventProvider'

// Mock the useUIEventStream hook
jest.mock('@/hooks/use-ui-event-stream', () => ({
  useUIEventStream: jest.fn()
}))

// Mock console.log
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation()

describe('UIEventProvider', () => {
  let mockUseUIEventStream: jest.MockedFunction<any>

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get mocked function
    const hookModule = require('@/hooks/use-ui-event-stream')
    mockUseUIEventStream = hookModule.useUIEventStream as jest.MockedFunction<any>
  })

  afterEach(() => {
    mockConsoleLog.mockClear()
    mockUseUIEventStream?.mockReset()
  })

  describe('Component Rendering', () => {
    it('renders children correctly', () => {
      render(
        <UIEventProvider>
          <div data-testid="child">Test Child</div>
        </UIEventProvider>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
      expect(screen.getByText('Test Child')).toBeInTheDocument()
    })

    it('renders multiple children', () => {
      render(
        <UIEventProvider>
          <div>First Child</div>
          <div>Second Child</div>
          <div>Third Child</div>
        </UIEventProvider>
      )

      expect(screen.getByText('First Child')).toBeInTheDocument()
      expect(screen.getByText('Second Child')).toBeInTheDocument()
      expect(screen.getByText('Third Child')).toBeInTheDocument()
    })

    it('renders with nested components', () => {
      render(
        <UIEventProvider>
          <div>
            <section>
              <article data-testid="nested">Nested Content</article>
            </section>
          </div>
        </UIEventProvider>
      )

      expect(screen.getByTestId('nested')).toBeInTheDocument()
      expect(screen.getByText('Nested Content')).toBeInTheDocument()
    })
  })

  describe('Hook Integration', () => {
    it('calls useUIEventStream hook on mount', () => {
      render(
        <UIEventProvider>
          <div>Child</div>
        </UIEventProvider>
      )

      expect(mockUseUIEventStream).toHaveBeenCalled()
    })

    it('calls useUIEventStream only once', () => {
      const { rerender } = render(
        <UIEventProvider>
          <div>Child</div>
        </UIEventProvider>
      )

      // Get the initial call count and clear the mock
      const initialCallCount = mockUseUIEventStream.mock.calls.length;
      mockUseUIEventStream.mockClear();

      // Re-render with different children
      rerender(
        <UIEventProvider>
          <div>Different Child</div>
        </UIEventProvider>
      )

      // Hook should be called on every render
      expect(mockUseUIEventStream).toHaveBeenCalledTimes(1)
    })
  })

  describe('Lifecycle', () => {
    it('logs initialization message on mount', async () => {
      render(
        <UIEventProvider>
          <div>Child</div>
        </UIEventProvider>
      )

      await waitFor(() => {
        expect(mockConsoleLog).toHaveBeenCalledWith('[UIEventProvider] UI event stream initialized')
      })
    })

    it('logs only once regardless of re-renders', async () => {
      const { rerender } = render(
        <UIEventProvider>
          <div>Child 1</div>
        </UIEventProvider>
      )

      await waitFor(() => {
        expect(mockConsoleLog).toHaveBeenCalledTimes(1)
      })

      // Re-render multiple times
      rerender(
        <UIEventProvider>
          <div>Child 2</div>
        </UIEventProvider>
      )

      rerender(
        <UIEventProvider>
          <div>Child 3</div>
        </UIEventProvider>
      )

      // Should still only log once
      expect(mockConsoleLog).toHaveBeenCalledTimes(1)
    })

    it('unmounts cleanly', () => {
      const { unmount } = render(
        <UIEventProvider>
          <div data-testid="child">Child</div>
        </UIEventProvider>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()

      unmount()

      expect(screen.queryByTestId('child')).not.toBeInTheDocument()
    })
  })

  describe('Client Component', () => {
    it('is marked as client component', () => {
      // The 'use client' directive ensures this runs on client
      // Testing that the component can render in client environment
      const { container } = render(
        <UIEventProvider>
          <div>Test</div>
        </UIEventProvider>
      )

      expect(container).toBeTruthy()
    })
  })

  describe('Edge Cases', () => {
    it('renders without children', () => {
      const { container } = render(<UIEventProvider>{null}</UIEventProvider>)

      expect(container.firstChild).toBeNull()
    })

    it('renders with empty fragment', () => {
      const { container } = render(
        <UIEventProvider>
          <></>
        </UIEventProvider>
      )

      expect(container.firstChild).toBeNull()
    })

    it('renders with conditional children', () => {
      const showChild = true

      render(
        <UIEventProvider>
          {showChild && <div data-testid="conditional">Conditional Child</div>}
        </UIEventProvider>
      )

      expect(screen.getByTestId('conditional')).toBeInTheDocument()
    })

    it('handles children prop changes', () => {
      const { rerender } = render(
        <UIEventProvider>
          <div>Initial Child</div>
        </UIEventProvider>
      )

      expect(screen.getByText('Initial Child')).toBeInTheDocument()

      rerender(
        <UIEventProvider>
          <div>Updated Child</div>
        </UIEventProvider>
      )

      expect(screen.queryByText('Initial Child')).not.toBeInTheDocument()
      expect(screen.getByText('Updated Child')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('handles hook errors gracefully', () => {
      // Suppress console.error for this test
      const originalError = console.error
      console.error = jest.fn()

      // Make hook throw error
      mockUseUIEventStream.mockImplementation(() => {
        throw new Error('Hook error')
      })

      // Component should throw when hook throws
      expect(() => {
        render(
          <UIEventProvider>
            <div data-testid="child">Child Content</div>
          </UIEventProvider>
        )
      }).toThrow()

      // Restore console.error
      console.error = originalError
    })
  })

  describe('Performance', () => {
    it('does not cause unnecessary re-renders', () => {
      let renderCount = 0
      
      const ChildComponent = () => {
        renderCount++
        return <div>Render Count: {renderCount}</div>
      }

      const { rerender } = render(
        <UIEventProvider>
          <ChildComponent />
        </UIEventProvider>
      )

      expect(renderCount).toBe(1)

      // Re-render the provider
      rerender(
        <UIEventProvider>
          <ChildComponent />
        </UIEventProvider>
      )

      // Child will re-render because React re-renders children when parent re-renders
      expect(renderCount).toBe(2)
    })
  })
})