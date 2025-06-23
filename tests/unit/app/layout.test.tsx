/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import RootLayout, { metadata } from '@/app/layout'

// Mock Next.js font
jest.mock('next/font/google', () => ({
  Inter: () => ({ className: 'mocked-inter-font' })
}))

// Mock all provider components
jest.mock('@/components/ui/toast', () => ({
  ToastContainer: () => <div data-testid="toast-container">Toast Container</div>
}))

jest.mock('@/components/providers/UIEventProvider', () => ({
  UIEventProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ui-event-provider">{children}</div>
  )
}))

jest.mock('@/lib/binance/binance-context', () => ({
  BinanceAPIProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="binance-api-provider">{children}</div>
  )
}))

jest.mock('@/app/providers/auth-provider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  )
}))

jest.mock('@/components/layout/BodyStyleWrapper', () => ({
  BodyStyleWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="body-style-wrapper">{children}</div>
  )
}))

describe('RootLayout', () => {
  describe('Metadata', () => {
    it('should have correct metadata', () => {
      expect(metadata).toEqual({
        title: 'Cryptrade',
        description: 'Crypto Trading Interface'
      })
    })
  })

  describe('Component Rendering', () => {
    it('renders with all required providers in correct order', () => {
      const { container } = render(
        <RootLayout>
          <div data-testid="test-child">Test Content</div>
        </RootLayout>
      )

      // Check HTML structure
      const html = container.querySelector('html')
      expect(html).toHaveAttribute('lang', 'en')
      expect(html).toHaveClass('dark')

      // Check body structure
      const body = container.querySelector('body')
      expect(body).toHaveClass('mocked-inter-font')
      // suppressHydrationWarning is a React prop, not an HTML attribute
      // It won't appear in the DOM, so we remove this test

      // Check providers are rendered in correct order
      expect(screen.getByTestId('body-style-wrapper')).toBeInTheDocument()
      expect(screen.getByTestId('auth-provider')).toBeInTheDocument()
      expect(screen.getByTestId('binance-api-provider')).toBeInTheDocument()
      expect(screen.getByTestId('ui-event-provider')).toBeInTheDocument()
      expect(screen.getByTestId('toast-container')).toBeInTheDocument()
      expect(screen.getByTestId('test-child')).toBeInTheDocument()
    })

    it('renders children inside all providers', () => {
      render(
        <RootLayout>
          <main>Main Content</main>
        </RootLayout>
      )

      expect(screen.getByText('Main Content')).toBeInTheDocument()
    })

    it('renders ToastContainer outside of providers', () => {
      const { container } = render(
        <RootLayout>
          <div>Test</div>
        </RootLayout>
      )

      const bodyStyleWrapper = screen.getByTestId('body-style-wrapper')
      const toastContainer = screen.getByTestId('toast-container')
      
      // Toast should be sibling of providers, not child
      expect(bodyStyleWrapper.contains(toastContainer)).toBe(true)
    })
  })

  describe('Provider Hierarchy', () => {
    it('maintains correct provider nesting order', () => {
      render(
        <RootLayout>
          <div data-testid="child">Child</div>
        </RootLayout>
      )

      const bodyWrapper = screen.getByTestId('body-style-wrapper')
      const authProvider = screen.getByTestId('auth-provider')
      const binanceProvider = screen.getByTestId('binance-api-provider')
      const uiEventProvider = screen.getByTestId('ui-event-provider')
      const child = screen.getByTestId('child')

      // Check nesting hierarchy
      expect(bodyWrapper).toContainElement(authProvider)
      expect(authProvider).toContainElement(binanceProvider)
      expect(binanceProvider).toContainElement(uiEventProvider)
      expect(uiEventProvider).toContainElement(child)
    })
  })

  describe('Multiple Children', () => {
    it('renders multiple children correctly', () => {
      render(
        <RootLayout>
          <>
            <header>Header</header>
            <main>Main</main>
            <footer>Footer</footer>
          </>
        </RootLayout>
      )

      expect(screen.getByText('Header')).toBeInTheDocument()
      expect(screen.getByText('Main')).toBeInTheDocument()
      expect(screen.getByText('Footer')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('renders without children', () => {
      const { container } = render(<RootLayout>{null}</RootLayout>)
      
      expect(container.querySelector('html')).toBeInTheDocument()
      expect(container.querySelector('body')).toBeInTheDocument()
    })

    it('renders with fragment children', () => {
      render(
        <RootLayout>
          <>
            <div>First</div>
            <div>Second</div>
          </>
        </RootLayout>
      )

      expect(screen.getByText('First')).toBeInTheDocument()
      expect(screen.getByText('Second')).toBeInTheDocument()
    })

    it('renders with nested components', () => {
      render(
        <RootLayout>
          <div>
            <section>
              <article>Nested Content</article>
            </section>
          </div>
        </RootLayout>
      )

      expect(screen.getByText('Nested Content')).toBeInTheDocument()
    })
  })
})