import React from 'react'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

describe('Card Components', () => {
  describe('Card', () => {
    it('renders correctly', () => {
      render(<Card>Card content</Card>)
      const card = screen.getByText('Card content')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'text-card-foreground', 'shadow-sm')
    })

    it('applies custom className', () => {
      render(<Card className="custom-card">Content</Card>)
      const card = screen.getByText('Content')
      expect(card).toHaveClass('custom-card')
    })

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<Card ref={ref}>Card</Card>)
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })

    it('passes through additional props', () => {
      render(<Card data-testid="test-card" role="article">Card</Card>)
      const card = screen.getByTestId('test-card')
      expect(card).toHaveAttribute('role', 'article')
    })
  })

  describe('CardHeader', () => {
    it('renders correctly', () => {
      render(
        <Card>
          <CardHeader>Header content</CardHeader>
        </Card>
      )
      const header = screen.getByText('Header content')
      expect(header).toBeInTheDocument()
      expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'p-6')
    })

    it('applies custom className', () => {
      render(
        <Card>
          <CardHeader className="custom-header">Header</CardHeader>
        </Card>
      )
      const header = screen.getByText('Header')
      expect(header).toHaveClass('custom-header')
    })
  })

  describe('CardTitle', () => {
    it('renders correctly', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
        </Card>
      )
      const title = screen.getByText('Card Title')
      expect(title).toBeInTheDocument()
      expect(title.tagName).toBe('H3')
      expect(title).toHaveClass('text-2xl', 'font-semibold', 'leading-none', 'tracking-tight')
    })

    it('applies custom className', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle className="custom-title">Title</CardTitle>
          </CardHeader>
        </Card>
      )
      const title = screen.getByText('Title')
      expect(title).toHaveClass('custom-title')
    })

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLParagraphElement>()
      render(
        <Card>
          <CardHeader>
            <CardTitle ref={ref}>Title</CardTitle>
          </CardHeader>
        </Card>
      )
      expect(ref.current).toBeInstanceOf(HTMLHeadingElement)
    })
  })

  describe('CardDescription', () => {
    it('renders correctly', () => {
      render(
        <Card>
          <CardHeader>
            <CardDescription>Description text</CardDescription>
          </CardHeader>
        </Card>
      )
      const description = screen.getByText('Description text')
      expect(description).toBeInTheDocument()
      expect(description.tagName).toBe('P')
      expect(description).toHaveClass('text-sm', 'text-muted-foreground')
    })

    it('applies custom className', () => {
      render(
        <Card>
          <CardHeader>
            <CardDescription className="custom-desc">Desc</CardDescription>
          </CardHeader>
        </Card>
      )
      const description = screen.getByText('Desc')
      expect(description).toHaveClass('custom-desc')
    })
  })

  describe('CardContent', () => {
    it('renders correctly', () => {
      render(
        <Card>
          <CardContent>Content area</CardContent>
        </Card>
      )
      const content = screen.getByText('Content area')
      expect(content).toBeInTheDocument()
      expect(content).toHaveClass('p-6', 'pt-0')
    })

    it('applies custom className', () => {
      render(
        <Card>
          <CardContent className="custom-content">Content</CardContent>
        </Card>
      )
      const content = screen.getByText('Content')
      expect(content).toHaveClass('custom-content')
    })
  })

  describe('CardFooter', () => {
    it('renders correctly', () => {
      render(
        <Card>
          <CardFooter>Footer content</CardFooter>
        </Card>
      )
      const footer = screen.getByText('Footer content')
      expect(footer).toBeInTheDocument()
      expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0')
    })

    it('applies custom className', () => {
      render(
        <Card>
          <CardFooter className="custom-footer">Footer</CardFooter>
        </Card>
      )
      const footer = screen.getByText('Footer')
      expect(footer).toHaveClass('custom-footer')
    })
  })

  describe('Complete Card composition', () => {
    it('renders a complete card with all components', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>This is a test card</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card content goes here</p>
          </CardContent>
          <CardFooter>
            <button>Action</button>
          </CardFooter>
        </Card>
      )

      expect(screen.getByText('Test Card')).toBeInTheDocument()
      expect(screen.getByText('This is a test card')).toBeInTheDocument()
      expect(screen.getByText('Card content goes here')).toBeInTheDocument()
      expect(screen.getByText('Action')).toBeInTheDocument()
    })

    it('handles nested content correctly', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Complex Card</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <h4>Nested heading</h4>
              <ul>
                <li>Item 1</li>
                <li>Item 2</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )

      expect(screen.getByText('Complex Card')).toBeInTheDocument()
      expect(screen.getByText('Nested heading')).toBeInTheDocument()
      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
    })
  })
})