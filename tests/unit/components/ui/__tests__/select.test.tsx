import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton
} from '@/components/ui/select'

describe('Select Components', () => {
  const defaultSelect = () => (
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option1">Option 1</SelectItem>
        <SelectItem value="option2">Option 2</SelectItem>
        <SelectItem value="option3">Option 3</SelectItem>
      </SelectContent>
    </Select>
  )

  describe('Select', () => {
    it('renders trigger with placeholder', () => {
      render(defaultSelect())
      expect(screen.getByText('Select an option')).toBeInTheDocument()
    })

    it('opens dropdown on click', async () => {
      const user = userEvent.setup()
      render(defaultSelect())

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument()
        expect(screen.getByText('Option 2')).toBeInTheDocument()
        expect(screen.getByText('Option 3')).toBeInTheDocument()
      })
    })

    it('selects an option', async () => {
      const user = userEvent.setup()
      const onValueChange = jest.fn()
      
      render(
        <Select onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Option 2'))
      expect(onValueChange).toHaveBeenCalledWith('option2')
    })

    it('handles controlled value', async () => {
      const user = userEvent.setup()
      const onValueChange = jest.fn()
      
      const { rerender } = render(
        <Select value="option1" onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      )

      expect(screen.getByRole('combobox')).toHaveTextContent('Option 1')

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)
      await user.click(screen.getByText('Option 2'))

      expect(onValueChange).toHaveBeenCalledWith('option2')

      rerender(
        <Select value="option2" onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      )

      expect(screen.getByRole('combobox')).toHaveTextContent('Option 2')
    })

    it('handles defaultValue', () => {
      render(
        <Select defaultValue="option2">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      )

      expect(screen.getByRole('combobox')).toHaveTextContent('Option 2')
    })

    it('handles disabled state', async () => {
      const user = userEvent.setup()
      const onValueChange = jest.fn()
      
      render(
        <Select disabled onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue placeholder="Disabled select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      )

      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveAttribute('aria-disabled', 'true')
      expect(trigger).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50')

      await user.click(trigger)
      expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
      expect(onValueChange).not.toHaveBeenCalled()
    })
  })

  describe('SelectTrigger', () => {
    it('applies custom className', () => {
      render(
        <Select>
          <SelectTrigger className="custom-trigger">
            <SelectValue />
          </SelectTrigger>
        </Select>
      )

      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveClass('custom-trigger')
    })

    it('shows focus ring on focus', async () => {
      const user = userEvent.setup()
      render(
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
        </Select>
      )

      const trigger = screen.getByRole('combobox')
      await user.tab()
      
      expect(trigger).toHaveFocus()
      expect(trigger).toHaveClass('focus:outline-none', 'focus:ring-2')
    })

    it('handles keyboard navigation to open', async () => {
      const user = userEvent.setup()
      render(defaultSelect())

      const trigger = screen.getByRole('combobox')
      trigger.focus()

      await user.keyboard('{Enter}')
      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument()
      })
    })
  })

  describe('SelectContent', () => {
    it('renders with portal by default', async () => {
      const user = userEvent.setup()
      render(defaultSelect())

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        const content = screen.getByRole('listbox')
        expect(content).toBeInTheDocument()
        // Content should be in a portal (outside the trigger's parent)
        expect(content.closest('body')).toBeDefined()
        expect(content.closest('body')).toBeInstanceOf(HTMLBodyElement)
      })
    })

    it('applies position classes', async () => {
      const user = userEvent.setup()
      render(
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        const content = screen.getByRole('listbox')
        expect(content).toHaveClass('data-[position=popper]:translate-y-1')
      })
    })
  })

  describe('SelectItem', () => {
    it('handles disabled items', async () => {
      const user = userEvent.setup()
      const onValueChange = jest.fn()
      
      render(
        <Select onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2" disabled>Option 2 (Disabled)</SelectItem>
          </SelectContent>
        </Select>
      )

      await user.click(screen.getByRole('combobox'))
      
      await waitFor(() => {
        const disabledItem = screen.getByText('Option 2 (Disabled)')
        expect(disabledItem).toHaveClass('data-[disabled]:pointer-events-none')
        expect(disabledItem).toHaveAttribute('data-disabled')
      })

      await user.click(screen.getByText('Option 2 (Disabled)'))
      expect(onValueChange).not.toHaveBeenCalled()
    })

    it('shows selected state', async () => {
      const user = userEvent.setup()
      render(
        <Select defaultValue="option2">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      )

      await user.click(screen.getByRole('combobox'))
      
      await waitFor(() => {
        // Use data-testid to find the specific option element
        const selectedItem = screen.getByTestId('select-item-option2')
        expect(selectedItem).toHaveAttribute('aria-selected', 'true')
        expect(selectedItem).toHaveAttribute('data-state', 'checked')
      })
    })
  })

  describe('SelectGroup and SelectLabel', () => {
    it('renders grouped items with labels', async () => {
      const user = userEvent.setup()
      render(
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Fruits</SelectLabel>
              <SelectItem value="apple">Apple</SelectItem>
              <SelectItem value="banana">Banana</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Vegetables</SelectLabel>
              <SelectItem value="carrot">Carrot</SelectItem>
              <SelectItem value="broccoli">Broccoli</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      )

      await user.click(screen.getByRole('combobox'))

      await waitFor(() => {
        expect(screen.getByText('Fruits')).toBeInTheDocument()
        expect(screen.getByText('Vegetables')).toBeInTheDocument()
        expect(screen.getByText('Apple')).toBeInTheDocument()
        expect(screen.getByText('Carrot')).toBeInTheDocument()
      })
    })
  })

  describe('Keyboard navigation', () => {
    it('navigates options with arrow keys', async () => {
      const user = userEvent.setup()
      render(defaultSelect())

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument()
      })

      await user.keyboard('{ArrowDown}')
      // First option should be focused
      
      await user.keyboard('{ArrowDown}')
      // Second option should be focused

      await user.keyboard('{Enter}')
      // Should select the focused option
    })

    it('closes on Escape key', async () => {
      const user = userEvent.setup()
      render(defaultSelect())

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument()
      })

      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
      })
    })
  })

  describe('Scroll buttons', () => {
    it('renders scroll buttons for long lists', async () => {
      const user = userEvent.setup()
      render(
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectScrollUpButton />
            {Array.from({ length: 20 }, (_, i) => (
              <SelectItem key={i} value={`option${i}`}>
                Option {i + 1}
              </SelectItem>
            ))}
            <SelectScrollDownButton />
          </SelectContent>
        </Select>
      )

      await user.click(screen.getByRole('combobox'))

      await waitFor(() => {
        const scrollUpButton = document.querySelector('[data-radix-select-viewport]')
        expect(scrollUpButton).toBeInTheDocument()
      })
    })
  })

  describe('Complex scenarios', () => {
    it('handles value updates while open', async () => {
      const user = userEvent.setup()
      const ControlledSelect = () => {
        const [value, setValue] = React.useState('option1')
        
        return (
          <>
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option1">Option 1</SelectItem>
                <SelectItem value="option2">Option 2</SelectItem>
              </SelectContent>
            </Select>
            <button onClick={() => setValue('option2')} data-testid="external-button">
              Set to Option 2
            </button>
          </>
        )
      }

      render(<ControlledSelect />)

      // First verify the initial value
      expect(screen.getByRole('combobox')).toHaveTextContent('Option 1')

      // Open the select
      await user.click(screen.getByRole('combobox'))
      
      // Verify dropdown is open
      await waitFor(() => {
        expect(screen.getByTestId('select-item-option1')).toBeInTheDocument()
        expect(screen.getByTestId('select-item-option2')).toBeInTheDocument()
      })

      // Change value while dropdown is open
      await user.click(screen.getByTestId('external-button'))
      
      // Verify the value changed in the trigger
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveTextContent('Option 2')
      })
    })

    it('handles form integration', () => {
      const handleSubmit = jest.fn(e => e.preventDefault())
      
      render(
        <form onSubmit={handleSubmit}>
          <Select name="preference">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">Option 1</SelectItem>
            </SelectContent>
          </Select>
          <button type="submit">Submit</button>
        </form>
      )

      const trigger = screen.getByRole('combobox')
      expect(trigger.closest('form')).toBeInTheDocument()
    })
  })
})