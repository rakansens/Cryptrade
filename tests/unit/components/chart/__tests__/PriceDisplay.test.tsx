/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import PriceDisplay from '@/components/chart/toolbar/PriceDisplay'
import { usePriceStream } from '@/hooks/market/use-price-stream'
import { useMarketTicker } from '@/hooks/market/use-market-stats'

// Mock dependencies
jest.mock('@/hooks/market/use-price-stream')
jest.mock('@/hooks/market/use-market-stats')

// Type assertions for mocked modules
const mockedUsePriceStream = usePriceStream as jest.MockedFunction<typeof usePriceStream>
const mockedUseMarketTicker = useMarketTicker as jest.MockedFunction<typeof useMarketTicker>
jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' ')
}))

describe('PriceDisplay', () => {
  const mockPriceStream = {
    currentPrice: 45123.45,
    change: 523.45,
    changePercent: 1.17,
    isConnected: true
  }

  const mockMarketTicker = {
    high24h: '46000.00',
    low24h: '44000.00',
    volume: '1234567890.12'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockedUsePriceStream.mockReturnValue(mockPriceStream as any)
    mockedUseMarketTicker.mockReturnValue(mockMarketTicker as any)
  })

  describe('Basic Rendering', () => {
    it('renders price display with all sections', () => {
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      // Connection status
      expect(screen.getByText('Live')).toBeInTheDocument()
      
      // Price
      expect(screen.getByText('$45123.45')).toBeInTheDocument()
      
      // Change amount and percent
      expect(screen.getByText('+523.45')).toBeInTheDocument()
      expect(screen.getByText('+1.17%')).toBeInTheDocument()
      
      // 24h stats
      expect(screen.getByText('24h高値')).toBeInTheDocument()
      expect(screen.getByText('24h安値')).toBeInTheDocument()
      expect(screen.getByText('24h出来高')).toBeInTheDocument()
    })

    it('shows USD label', () => {
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      expect(screen.getByText('USD')).toBeInTheDocument()
    })
  })

  describe('Price Formatting', () => {
    it('formats price with 2 decimal places', () => {
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      expect(screen.getByText('$45123.45')).toBeInTheDocument()
    })

    it('shows --- when price is 0', () => {
      mockedUsePriceStream.mockReturnValue({
        ...mockPriceStream,
        currentPrice: 0
      } as any)
      
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      expect(screen.getByText('$---')).toBeInTheDocument()
    })

    it('shows positive sign for positive changes', () => {
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      expect(screen.getByText('+523.45')).toBeInTheDocument()
      expect(screen.getByText('+1.17%')).toBeInTheDocument()
    })

    it('shows negative values without extra sign', () => {
      mockedUsePriceStream.mockReturnValue({
        ...mockPriceStream,
        change: -523.45,
        changePercent: -1.17
      } as any)
      
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      expect(screen.getByText('-523.45')).toBeInTheDocument()
      expect(screen.getByText('-1.17%')).toBeInTheDocument()
    })
  })

  describe('Connection Status', () => {
    it('shows connected status with green indicator', () => {
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      expect(screen.getByText('Live')).toBeInTheDocument()
      
      const indicator = screen.getByText('Live').previousElementSibling
      expect(indicator).toHaveClass('bg-[hsl(var(--color-profit))]')
    })

    it('shows disconnected status with red indicator', () => {
      mockedUsePriceStream.mockReturnValue({
        ...mockPriceStream,
        isConnected: false
      } as any)
      
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      expect(screen.getByText('Offline')).toBeInTheDocument()
      
      const indicator = screen.getByText('Offline').previousElementSibling
      expect(indicator).toHaveClass('bg-[hsl(var(--color-loss))]')
    })

    it('shows pulsing animation on status indicator', () => {
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      const indicator = screen.getByText('Live').previousElementSibling
      expect(indicator).toHaveClass('animate-pulse')
    })
  })

  describe('Price Colors', () => {
    it('shows green color for positive changes', () => {
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      const priceElement = screen.getByText('$45123.45')
      expect(priceElement).toHaveClass('text-[hsl(var(--color-profit))]')
      
      const changeElement = screen.getByText('+523.45').parentElement
      expect(changeElement).toHaveClass('text-[hsl(var(--color-profit))]')
    })

    it('shows red color for negative changes', () => {
      mockedUsePriceStream.mockReturnValue({
        ...mockPriceStream,
        change: -523.45,
        changePercent: -1.17
      } as any)
      
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      const priceElement = screen.getByText('$45123.45')
      expect(priceElement).toHaveClass('text-[hsl(var(--color-loss))]')
      
      const changeElement = screen.getByText('-523.45').parentElement
      expect(changeElement).toHaveClass('text-[hsl(var(--color-loss))]')
    })
  })

  describe('Price Animation', () => {
    it('triggers animation when price changes', async () => {
      const { rerender } = render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      // Update price
      mockedUsePriceStream.mockReturnValue({
        ...mockPriceStream,
        currentPrice: 45223.45
      } as any)
      
      rerender(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      const priceElement = screen.getByText('$45223.45')
      expect(priceElement).toHaveClass('price-update')
      
      // Animation should be removed after 500ms
      await waitFor(() => {
        expect(priceElement).not.toHaveClass('price-update')
      }, { timeout: 600 })
    })

    it('does not trigger animation when price is 0', () => {
      const { rerender } = render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      mockedUsePriceStream.mockReturnValue({
        ...mockPriceStream,
        currentPrice: 0
      } as any)
      
      rerender(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      const priceElement = screen.getByText('$---')
      expect(priceElement).not.toHaveClass('price-update')
    })
  })

  describe('Direction Indicators', () => {
    it('shows up arrow for positive changes', () => {
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      expect(screen.getByText('↑')).toBeInTheDocument()
    })

    it('shows down arrow for negative changes', () => {
      mockedUsePriceStream.mockReturnValue({
        ...mockPriceStream,
        change: -523.45,
        changePercent: -1.17
      } as any)
      
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      expect(screen.getByText('↓')).toBeInTheDocument()
    })
  })

  describe('24h Statistics', () => {
    it('formats high24h correctly', () => {
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      expect(screen.getByText('$46000.00')).toBeInTheDocument()
    })

    it('formats low24h correctly', () => {
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      expect(screen.getByText('$44000.00')).toBeInTheDocument()
    })

    it('formats volume in millions', () => {
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      expect(screen.getByText('1234.57M USDT')).toBeInTheDocument()
    })

    it('shows --- when stats are null', () => {
      ;jest.mocked(useMarketTicker).mockReturnValue({
        high24h: null,
        low24h: null,
        volume: null
      } as any)
      
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      const dashes = screen.getAllByText('---')
      expect(dashes).toHaveLength(3)
    })
  })

  describe('Responsive Design', () => {
    it('hides 24h stats on small screens', () => {
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      const statsContainer = screen.getByText('24h高値').parentElement?.parentElement
      expect(statsContainer).toHaveClass('hidden', 'lg:flex')
    })
  })

  describe('Component Props', () => {
    it('uses provided symbol for hooks', () => {
      render(<PriceDisplay symbol="ETHUSDT" symbolName="ETH/USDT" />)
      
      expect(usePriceStream).toHaveBeenCalledWith('ETHUSDT')
      expect(useMarketTicker).toHaveBeenCalledWith('ETHUSDT')
    })
  })

  describe('Styling', () => {
    it('applies correct text sizes', () => {
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      const priceElement = screen.getByText('$45123.45')
      expect(priceElement).toHaveClass('text-[2rem]', 'font-bold', 'font-mono')
    })

    it('applies premium glass styling to percentage badge', () => {
      render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      const percentBadge = screen.getByText('+1.17%')
      expect(percentBadge).toHaveClass('premium-glass-subtle')
    })
  })

  describe('Memoization', () => {
    it('memoizes price formatting', () => {
      const { rerender } = render(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      // Re-render with same props
      rerender(<PriceDisplay symbol="BTCUSDT" symbolName="BTC/USDT" />)
      
      // Price should still be displayed (memoized)
      expect(screen.getByText('$45123.45')).toBeInTheDocument()
    })
  })
})
