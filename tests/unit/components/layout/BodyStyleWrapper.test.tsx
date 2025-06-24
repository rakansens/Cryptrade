/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { BodyStyleWrapper } from '@/components/layout/BodyStyleWrapper'

describe('BodyStyleWrapper', () => {
  let originalBodyClassList: DOMTokenList

  beforeEach(() => {
    // Store original classList
    originalBodyClassList = document.body.classList
    
    // Clear body classes
    document.body.className = ''
  })

  afterEach(() => {
    // Restore original classList
    document.body.classList = originalBodyClassList
  })

  describe('Component Rendering', () => {
    it('renders children correctly', () => {
      render(
        <BodyStyleWrapper>
          <div data-testid="child">Test Child</div>
        </BodyStyleWrapper>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
      expect(screen.getByText('Test Child')).toBeInTheDocument()
    })

    it('renders multiple children', () => {
      render(
        <BodyStyleWrapper>
          <div>First</div>
          <div>Second</div>
          <div>Third</div>
        </BodyStyleWrapper>
      )

      expect(screen.getByText('First')).toBeInTheDocument()
      expect(screen.getByText('Second')).toBeInTheDocument()
      expect(screen.getByText('Third')).toBeInTheDocument()
    })

    it('renders nested components', () => {
      render(
        <BodyStyleWrapper>
          <div>
            <section>
              <article data-testid="nested">Nested Content</article>
            </section>
          </div>
        </BodyStyleWrapper>
      )

      expect(screen.getByTestId('nested')).toBeInTheDocument()
    })
  })

  describe('Body Class Management', () => {
    it('adds classes to body on mount', () => {
      render(
        <BodyStyleWrapper>
          <div>Content</div>
        </BodyStyleWrapper>
      )

      expect(document.body.classList.contains('bg-background')).toBe(true)
      expect(document.body.classList.contains('text-foreground')).toBe(true)
    })

    it('removes classes from body on unmount', () => {
      const { unmount } = render(
        <BodyStyleWrapper>
          <div>Content</div>
        </BodyStyleWrapper>
      )

      // Classes should be added
      expect(document.body.classList.contains('bg-background')).toBe(true)
      expect(document.body.classList.contains('text-foreground')).toBe(true)

      // Unmount component
      unmount()

      // Classes should be removed
      expect(document.body.classList.contains('bg-background')).toBe(false)
      expect(document.body.classList.contains('text-foreground')).toBe(false)
    })

    it('preserves existing body classes', () => {
      // Add some existing classes
      document.body.classList.add('existing-class')
      document.body.classList.add('another-class')

      render(
        <BodyStyleWrapper>
          <div>Content</div>
        </BodyStyleWrapper>
      )

      // New classes should be added
      expect(document.body.classList.contains('bg-background')).toBe(true)
      expect(document.body.classList.contains('text-foreground')).toBe(true)
      
      // Existing classes should be preserved
      expect(document.body.classList.contains('existing-class')).toBe(true)
      expect(document.body.classList.contains('another-class')).toBe(true)
    })

    it('only removes its own classes on unmount', () => {
      // Add some existing classes
      document.body.classList.add('existing-class')

      const { unmount } = render(
        <BodyStyleWrapper>
          <div>Content</div>
        </BodyStyleWrapper>
      )

      // Add another class after render
      document.body.classList.add('added-after')

      unmount()

      // Only BodyStyleWrapper classes should be removed
      expect(document.body.classList.contains('bg-background')).toBe(false)
      expect(document.body.classList.contains('text-foreground')).toBe(false)
      
      // Other classes should remain
      expect(document.body.classList.contains('existing-class')).toBe(true)
      expect(document.body.classList.contains('added-after')).toBe(true)
    })
  })

  describe('Client Component', () => {
    it('is marked as client component', () => {
      // The 'use client' directive ensures this runs on client
      // Testing that the component can render in client environment
      const { container } = render(
        <BodyStyleWrapper>
          <div>Test</div>
        </BodyStyleWrapper>
      )

      expect(container).toBeDefined()
      expect(container.firstChild).toBeDefined()
      expect(container.textContent).toBe('Test')
    })
  })

  describe('Multiple Instances', () => {
    it('handles multiple instances correctly', () => {
      const { unmount: unmount1 } = render(
        <BodyStyleWrapper>
          <div>Instance 1</div>
        </BodyStyleWrapper>
      )

      const { unmount: unmount2 } = render(
        <BodyStyleWrapper>
          <div>Instance 2</div>
        </BodyStyleWrapper>
      )

      // Classes should still be present
      expect(document.body.classList.contains('bg-background')).toBe(true)
      expect(document.body.classList.contains('text-foreground')).toBe(true)

      // Unmount first instance
      unmount1()

      // Classes might be removed and re-added by second instance
      // This depends on React's render timing

      // Unmount second instance
      unmount2()

      // Classes should be removed after all instances unmount
      expect(document.body.classList.contains('bg-background')).toBe(false)
      expect(document.body.classList.contains('text-foreground')).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('renders without children', () => {
      const { container } = render(
        <BodyStyleWrapper>
          {null}
        </BodyStyleWrapper>
      )

      expect(container.firstChild).toBeNull()
      
      // Should still add body classes
      expect(document.body.classList.contains('bg-background')).toBe(true)
      expect(document.body.classList.contains('text-foreground')).toBe(true)
    })

    it('renders with fragment children', () => {
      render(
        <BodyStyleWrapper>
          <>
            <div>Fragment Child 1</div>
            <div>Fragment Child 2</div>
          </>
        </BodyStyleWrapper>
      )

      expect(screen.getByText('Fragment Child 1')).toBeInTheDocument()
      expect(screen.getByText('Fragment Child 2')).toBeInTheDocument()
    })

    it('handles re-renders without re-applying classes', () => {
      const { rerender } = render(
        <BodyStyleWrapper>
          <div>Initial</div>
        </BodyStyleWrapper>
      )

      // Clear one of the classes manually
      document.body.classList.remove('bg-background')
      
      // Re-render with different children
      rerender(
        <BodyStyleWrapper>
          <div>Updated</div>
        </BodyStyleWrapper>
      )

      // Class should not be re-added on re-render
      // (useEffect with empty deps array runs only once)
      expect(document.body.classList.contains('bg-background')).toBe(false)
      expect(document.body.classList.contains('text-foreground')).toBe(true)
    })

    it('handles conditional rendering', () => {
      const { rerender } = render(
        <BodyStyleWrapper>
          {true && <div>Visible</div>}
        </BodyStyleWrapper>
      )

      expect(screen.getByText('Visible')).toBeInTheDocument()

      rerender(
        <BodyStyleWrapper>
          {false && <div>Hidden</div>}
        </BodyStyleWrapper>
      )

      expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
      
      // Body classes should remain
      expect(document.body.classList.contains('bg-background')).toBe(true)
      expect(document.body.classList.contains('text-foreground')).toBe(true)
    })
  })

  describe('Performance', () => {
    it('does not cause unnecessary effects on re-render', () => {
      const addSpy = jest.spyOn(document.body.classList, 'add')
      const removeSpy = jest.spyOn(document.body.classList, 'remove')

      const { rerender } = render(
        <BodyStyleWrapper>
          <div>Content</div>
        </BodyStyleWrapper>
      )

      // Should be called once on mount
      expect(addSpy).toHaveBeenCalledTimes(1) // Once for both classes

      // Clear mock calls
      addSpy.mockClear()
      removeSpy.mockClear()

      // Re-render multiple times
      rerender(
        <BodyStyleWrapper>
          <div>Updated 1</div>
        </BodyStyleWrapper>
      )

      rerender(
        <BodyStyleWrapper>
          <div>Updated 2</div>
        </BodyStyleWrapper>
      )

      // Should not be called again on re-renders
      expect(addSpy).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()

      addSpy.mockRestore()
      removeSpy.mockRestore()
    })
  })
})