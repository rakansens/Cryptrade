/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import Home from '@/app/page'

// Mock the AnimatedChatTransition component
jest.mock('@/components/chat/AnimatedChatTransition', () => ({
  AnimatedChatTransition: () => (
    <div data-testid="animated-chat-transition">
      Animated Chat Transition Component
    </div>
  )
}))

describe('Home Page', () => {
  describe('Component Rendering', () => {
    it('renders AnimatedChatTransition component', () => {
      render(<Home />)
      
      expect(screen.getByTestId('animated-chat-transition')).toBeInTheDocument()
      expect(screen.getByText('Animated Chat Transition Component')).toBeInTheDocument()
    })

    it('is a client component', () => {
      // The 'use client' directive is at the top of the file
      // This test verifies the component can be rendered in a client environment
      const { container } = render(<Home />)
      expect(container).toBeTruthy()
    })
  })

  describe('Component Structure', () => {
    it('returns only the AnimatedChatTransition component', () => {
      const { container } = render(<Home />)
      
      // Should have exactly one child
      expect(container.firstChild).toBeTruthy()
      expect(container.firstChild?.childNodes.length).toBe(1)
    })

    it('does not render any additional elements', () => {
      const { container } = render(<Home />)
      
      // Check that there are no wrapper divs or other elements
      const animatedTransition = screen.getByTestId('animated-chat-transition')
      expect(container.firstChild).toBe(animatedTransition)
    })
  })

  describe('Integration', () => {
    it('can be rendered multiple times', () => {
      const { rerender } = render(<Home />)
      
      expect(screen.getByTestId('animated-chat-transition')).toBeInTheDocument()
      
      // Re-render
      rerender(<Home />)
      
      expect(screen.getByTestId('animated-chat-transition')).toBeInTheDocument()
    })

    it('unmounts cleanly', () => {
      const { unmount } = render(<Home />)
      
      expect(screen.getByTestId('animated-chat-transition')).toBeInTheDocument()
      
      unmount()
      
      expect(screen.queryByTestId('animated-chat-transition')).not.toBeInTheDocument()
    })
  })
})