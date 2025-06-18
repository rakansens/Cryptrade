import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, buttonVariants } from '@/components/ui/button'

describe('Button', () => {
  it('renders correctly with default props', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: 'Click me' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass(buttonVariants())
  })

  describe('variants', () => {
    it.each([
      ['default', 'bg-primary'],
      ['destructive', 'bg-destructive'],
      ['success', 'bg-success'],
      ['warning', 'bg-warning'],
      ['error', 'bg-error'],
      ['accentBlue', 'bg-accentBlue'],
      ['outline', 'border'],
      ['secondary', 'bg-secondary'],
      ['ghost', 'hover:bg-accent'],
      ['link', 'underline-offset-4'],
    ])('renders %s variant correctly', (variant, expectedClass) => {
      render(<Button variant={variant as any}>Button</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain(expectedClass)
    })
  })

  describe('sizes', () => {
    it.each([
      ['default', 'h-10'],
      ['sm', 'h-9'],
      ['lg', 'h-11'],
      ['icon', 'h-10 w-10'],
    ])('renders %s size correctly', (size, expectedClass) => {
      render(<Button size={size as any}>Button</Button>)
      const button = screen.getByRole('button')
      expectedClass.split(' ').forEach(cls => {
        expect(button.className).toContain(cls)
      })
    })
  })

  it('handles click events', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    
    render(<Button onClick={handleClick}>Click me</Button>)
    const button = screen.getByRole('button', { name: 'Click me' })
    
    await user.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('respects disabled state', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    
    render(<Button disabled onClick={handleClick}>Disabled</Button>)
    const button = screen.getByRole('button', { name: 'Disabled' })
    
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:opacity-50')
    
    await user.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Button</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('renders as child when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )
    
    const link = screen.getByRole('link', { name: 'Link Button' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test')
    expect(link).toHaveClass(buttonVariants())
  })

  it('applies custom className', () => {
    render(<Button className="custom-class">Button</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('applies active state styles on mousedown', () => {
    render(<Button>Active Button</Button>)
    const button = screen.getByRole('button')
    
    fireEvent.mouseDown(button)
    expect(button).toHaveClass('active:scale-[0.98]')
  })

  it('shows focus ring on keyboard focus', async () => {
    const user = userEvent.setup()
    render(<Button>Focusable</Button>)
    const button = screen.getByRole('button')
    
    await user.tab()
    expect(button).toHaveFocus()
    expect(button).toHaveClass('focus-visible:ring-2')
  })

  it('passes through additional props', () => {
    render(
      <Button 
        data-testid="custom-button" 
        aria-label="Custom Label"
        type="submit"
      >
        Button
      </Button>
    )
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('data-testid', 'custom-button')
    expect(button).toHaveAttribute('aria-label', 'Custom Label')
    expect(button).toHaveAttribute('type', 'submit')
  })

  it('handles keyboard events', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    
    render(<Button onClick={handleClick}>Keyboard Button</Button>)
    const button = screen.getByRole('button')
    
    button.focus()
    await user.keyboard('{Enter}')
    expect(handleClick).toHaveBeenCalled()
    
    await user.keyboard(' ')
    expect(handleClick).toHaveBeenCalledTimes(2)
  })
})