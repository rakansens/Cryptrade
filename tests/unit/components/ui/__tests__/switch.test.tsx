import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Switch } from '@/components/ui/switch'

describe('Switch', () => {
  it('renders correctly', () => {
    render(<Switch />)
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toBeInTheDocument()
    expect(switchElement).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles on click', async () => {
    const user = userEvent.setup()
    render(<Switch />)
    const switchElement = screen.getByRole('switch')

    expect(switchElement).toHaveAttribute('aria-checked', 'false')
    expect(switchElement).toHaveAttribute('data-state', 'unchecked')

    await user.click(switchElement)
    
    expect(switchElement).toHaveAttribute('aria-checked', 'true')
    expect(switchElement).toHaveAttribute('data-state', 'checked')

    await user.click(switchElement)
    
    expect(switchElement).toHaveAttribute('aria-checked', 'false')
    expect(switchElement).toHaveAttribute('data-state', 'unchecked')
  })

  it('handles controlled state', async () => {
    const user = userEvent.setup()
    const onCheckedChange = jest.fn()
    
    const { rerender } = render(
      <Switch checked={false} onCheckedChange={onCheckedChange} />
    )
    const switchElement = screen.getByRole('switch')

    expect(switchElement).toHaveAttribute('aria-checked', 'false')

    await user.click(switchElement)
    expect(onCheckedChange).toHaveBeenCalledWith(true)

    rerender(<Switch checked={true} onCheckedChange={onCheckedChange} />)
    expect(switchElement).toHaveAttribute('aria-checked', 'true')

    await user.click(switchElement)
    expect(onCheckedChange).toHaveBeenCalledWith(false)
  })

  it('respects disabled state', async () => {
    const user = userEvent.setup()
    const onCheckedChange = jest.fn()
    
    render(<Switch disabled onCheckedChange={onCheckedChange} />)
    const switchElement = screen.getByRole('switch')

    expect(switchElement).toBeDisabled()
    expect(switchElement).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50')

    await user.click(switchElement)
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('applies custom className', () => {
    render(<Switch className="custom-switch" />)
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toHaveClass('custom-switch')
  })

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup()
    const onCheckedChange = jest.fn()
    
    render(<Switch onCheckedChange={onCheckedChange} />)
    const switchElement = screen.getByRole('switch')

    switchElement.focus()
    expect(switchElement).toHaveFocus()

    await user.keyboard(' ')
    expect(onCheckedChange).toHaveBeenCalledWith(true)

    await user.keyboard('{Enter}')
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('shows focus ring on keyboard focus', async () => {
    const user = userEvent.setup()
    render(<Switch />)
    const switchElement = screen.getByRole('switch')

    await user.tab()
    expect(switchElement).toHaveFocus()
    expect(switchElement).toHaveClass(
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-ring',
      'focus-visible:ring-offset-2'
    )
  })

  it('renders with defaultChecked', () => {
    render(<Switch defaultChecked />)
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toHaveAttribute('aria-checked', 'true')
    expect(switchElement).toHaveAttribute('data-state', 'checked')
  })

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(<Switch ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('maintains proper ARIA attributes', () => {
    render(
      <Switch
        aria-label="Toggle feature"
        aria-describedby="switch-description"
      />
    )
    const switchElement = screen.getByRole('switch')
    
    expect(switchElement).toHaveAttribute('aria-label', 'Toggle feature')
    expect(switchElement).toHaveAttribute('aria-describedby', 'switch-description')
  })

  it('animates thumb position on toggle', async () => {
    const user = userEvent.setup()
    render(<Switch />)
    const switchElement = screen.getByRole('switch')
    const thumb = switchElement.querySelector('[data-state]')

    expect(thumb).toHaveClass('translate-x-0')

    await user.click(switchElement)
    expect(thumb).toHaveClass('translate-x-5')
  })

  it('applies correct background colors for states', () => {
    const { rerender } = render(<Switch checked={false} />)
    const switchElement = screen.getByRole('switch')

    expect(switchElement).toHaveClass('data-[state=unchecked]:bg-input')

    rerender(<Switch checked={true} />)
    expect(switchElement).toHaveClass('data-[state=checked]:bg-primary')
  })

  it('handles rapid toggling', async () => {
    const user = userEvent.setup()
    const onCheckedChange = jest.fn()
    
    render(<Switch onCheckedChange={onCheckedChange} />)
    const switchElement = screen.getByRole('switch')

    // Rapid clicks
    await user.click(switchElement)
    await user.click(switchElement)
    await user.click(switchElement)
    await user.click(switchElement)

    expect(onCheckedChange).toHaveBeenCalledTimes(4)
    expect(onCheckedChange).toHaveBeenNthCalledWith(1, true)
    expect(onCheckedChange).toHaveBeenNthCalledWith(2, false)
    expect(onCheckedChange).toHaveBeenNthCalledWith(3, true)
    expect(onCheckedChange).toHaveBeenNthCalledWith(4, false)
  })

  it('works within a form', () => {
    const handleSubmit = jest.fn(e => e.preventDefault())
    
    render(
      <form onSubmit={handleSubmit}>
        <Switch name="feature-toggle" />
        <button type="submit">Submit</button>
      </form>
    )

    const switchElement = screen.getByRole('switch')
    expect(switchElement).toHaveAttribute('name', 'feature-toggle')
  })

  it('supports custom data attributes', () => {
    render(
      <Switch
        data-testid="custom-switch"
        data-feature="dark-mode"
      />
    )

    const switchElement = screen.getByRole('switch')
    expect(switchElement).toHaveAttribute('data-testid', 'custom-switch')
    expect(switchElement).toHaveAttribute('data-feature', 'dark-mode')
  })
})