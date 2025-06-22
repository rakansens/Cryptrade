import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/input'

describe('Input', () => {
  it('renders correctly', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveClass(
      'flex',
      'h-10',
      'w-full',
      'rounded-md',
      'border',
      'border-input',
      'bg-background',
      'px-3',
      'py-2',
      'text-sm'
    )
  })

  it('accepts and displays input value', async () => {
    const user = userEvent.setup()
    render(<Input />)
    const input = screen.getByRole('textbox')

    await user.type(input, 'Hello World')
    expect(input).toHaveValue('Hello World')
  })

  it('handles controlled input', () => {
    const handleChange = jest.fn()
    const { rerender } = render(
      <Input value="initial" onChange={handleChange} />
    )
    const input = screen.getByRole('textbox') as HTMLInputElement

    expect(input.value).toBe('initial')

    fireEvent.change(input, { target: { value: 'updated' } })
    expect(handleChange).toHaveBeenCalled()

    rerender(<Input value="updated" onChange={handleChange} />)
    expect(input.value).toBe('updated')
  })

  it('applies custom className', () => {
    render(<Input className="custom-input" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('custom-input')
  })

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLInputElement>()
    render(<Input ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it('handles disabled state', async () => {
    const user = userEvent.setup()
    render(<Input disabled />)
    const input = screen.getByRole('textbox')

    expect(input).toBeDisabled()
    expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50')

    await user.type(input, 'Should not appear')
    expect(input).toHaveValue('')
  })

  it('supports different input types', () => {
    const { rerender } = render(<Input type="email" />)
    let input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('type', 'email')

    rerender(<Input type="password" />)
    input = screen.getByTestId('input')
    expect(input).toHaveAttribute('type', 'password')

    rerender(<Input type="number" />)
    input = screen.getByRole('spinbutton')
    expect(input).toHaveAttribute('type', 'number')
  })

  it('handles placeholder text', () => {
    render(<Input placeholder="Enter text here" />)
    const input = screen.getByPlaceholderText('Enter text here')
    expect(input).toBeInTheDocument()
  })

  it('handles focus and blur events', async () => {
    const handleFocus = jest.fn()
    const handleBlur = jest.fn()
    const user = userEvent.setup()

    render(<Input onFocus={handleFocus} onBlur={handleBlur} />)
    const input = screen.getByRole('textbox')

    await user.click(input)
    expect(handleFocus).toHaveBeenCalledTimes(1)

    await user.tab()
    expect(handleBlur).toHaveBeenCalledTimes(1)
  })

  it('shows focus ring on focus', async () => {
    const user = userEvent.setup()
    render(<Input />)
    const input = screen.getByRole('textbox')

    await user.click(input)
    expect(input).toHaveClass('focus-visible:outline-none', 'focus-visible:ring-2')
  })

  it('handles readonly state', async () => {
    const user = userEvent.setup()
    render(<Input readOnly value="Read only text" />)
    const input = screen.getByRole('textbox')

    expect(input).toHaveAttribute('readonly')
    expect(input).toHaveValue('Read only text')

    await user.type(input, 'Should not change')
    expect(input).toHaveValue('Read only text')
  })

  it('handles required attribute', () => {
    render(<Input required />)
    const input = screen.getByRole('textbox')
    expect(input).toBeRequired()
  })

  it('handles autocomplete attribute', () => {
    render(<Input autoComplete="email" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('autocomplete', 'email')
  })

  it('handles keyboard events', async () => {
    const handleKeyDown = jest.fn()
    const handleKeyUp = jest.fn()
    const user = userEvent.setup()

    render(<Input onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} />)
    const input = screen.getByRole('textbox')

    input.focus()
    await user.keyboard('{Enter}')
    
    expect(handleKeyDown).toHaveBeenCalled()
    expect(handleKeyUp).toHaveBeenCalled()
  })

  it('handles paste events', async () => {
    const handlePaste = jest.fn()
    render(<Input onPaste={handlePaste} />)
    const input = screen.getByRole('textbox')

    fireEvent.paste(input, {
      clipboardData: {
        getData: jest.fn(() => 'pasted text'),
        types: ['text/plain']
      }
    })

    expect(handlePaste).toHaveBeenCalled()
  })

  it('supports maxLength attribute', async () => {
    const user = userEvent.setup()
    render(<Input maxLength={5} />)
    const input = screen.getByRole('textbox')

    await user.type(input, 'Hello World')
    expect(input).toHaveValue('Hello')
  })

  it('supports pattern validation', () => {
    render(<Input pattern="[0-9]*" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('pattern', '[0-9]*')
  })

  it('maintains proper ARIA attributes', () => {
    render(
      <Input
        aria-label="Test input"
        aria-describedby="input-help"
        aria-invalid="true"
      />
    )
    const input = screen.getByRole('textbox')
    
    expect(input).toHaveAttribute('aria-label', 'Test input')
    expect(input).toHaveAttribute('aria-describedby', 'input-help')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })
})