import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay
} from '@/components/ui/dialog'

describe('Dialog Components', () => {
  describe('Dialog', () => {
    it('renders trigger and opens dialog on click', async () => {
      const user = userEvent.setup()
      
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
            <DialogDescription>This is a test dialog</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      const trigger = screen.getByText('Open Dialog')
      expect(trigger).toBeInTheDocument()

      await user.click(trigger)
      
      await waitFor(() => {
        expect(screen.getByText('Test Dialog')).toBeInTheDocument()
        expect(screen.getByText('This is a test dialog')).toBeInTheDocument()
      })
    })

    it('closes dialog on close button click', async () => {
      const user = userEvent.setup()
      
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Dialog</DialogTitle>
              <DialogClose />
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Test Dialog')).toBeInTheDocument()

      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument()
      })
    })

    it('closes dialog on overlay click', async () => {
      const user = userEvent.setup()
      
      render(
        <Dialog defaultOpen>
          <DialogPortal>
            <DialogOverlay />
            <DialogContent>
              <DialogTitle>Test Dialog</DialogTitle>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      )

      const overlay = document.querySelector('[data-radix-dialog-overlay]')
      expect(overlay).toBeInTheDocument()

      if (overlay) {
        await user.click(overlay)
      }

      await waitFor(() => {
        expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument()
      })
    })

    it('handles controlled state', async () => {
      const user = userEvent.setup()
      const onOpenChange = jest.fn()
      
      const { rerender } = render(
        <Dialog open={false} onOpenChange={onOpenChange}>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Controlled Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      await user.click(screen.getByText('Open'))
      expect(onOpenChange).toHaveBeenCalledWith(true)

      rerender(
        <Dialog open={true} onOpenChange={onOpenChange}>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Controlled Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Controlled Dialog')).toBeInTheDocument()
    })

    it('traps focus within dialog', async () => {
      const user = userEvent.setup()
      
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Focus Trap Test</DialogTitle>
            </DialogHeader>
            <input data-testid="input-1" />
            <button data-testid="button-1">Button 1</button>
            <button data-testid="button-2">Button 2</button>
          </DialogContent>
        </Dialog>
      )

      const input = screen.getByTestId('input-1')
      const button1 = screen.getByTestId('button-1')
      const button2 = screen.getByTestId('button-2')

      input.focus()
      expect(input).toHaveFocus()

      await user.tab()
      expect(button1).toHaveFocus()

      await user.tab()
      expect(button2).toHaveFocus()
    })

    it('prevents scroll when dialog is open', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Scroll Lock Test</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      // Check that body has overflow hidden or similar scroll-locking mechanism
      expect(document.body.style.pointerEvents).toBe('none')
    })
  })

  describe('DialogContent', () => {
    it('applies custom className', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent className="custom-content">
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      const content = screen.getByRole('dialog')
      expect(content).toHaveClass('custom-content')
    })

    it('renders with proper ARIA attributes', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Accessible Dialog</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogContent>
        </Dialog>
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby')
      expect(dialog).toHaveAttribute('aria-describedby')
    })
  })

  describe('DialogHeader', () => {
    it('renders children correctly', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Header Title</DialogTitle>
              <DialogDescription>Header Description</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Header Title')).toBeInTheDocument()
      expect(screen.getByText('Header Description')).toBeInTheDocument()
    })

    it('applies correct spacing', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogHeader className="test-header">
              <DialogTitle>Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )

      const header = document.querySelector('.test-header')
      expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5')
    })
  })

  describe('DialogFooter', () => {
    it('renders footer content', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogFooter>
              <button>Cancel</button>
              <button>Save</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Save')).toBeInTheDocument()
    })

    it('applies responsive layout', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogFooter className="test-footer">
              <button>Action</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )

      const footer = document.querySelector('.test-footer')
      expect(footer).toHaveClass('flex', 'flex-col-reverse', 'sm:flex-row')
    })
  })

  describe('DialogTrigger', () => {
    it('renders as child element', () => {
      render(
        <Dialog>
          <DialogTrigger asChild>
            <button className="custom-trigger">Custom Trigger</button>
          </DialogTrigger>
        </Dialog>
      )

      const trigger = screen.getByText('Custom Trigger')
      expect(trigger).toHaveClass('custom-trigger')
      expect(trigger.tagName).toBe('BUTTON')
    })

    it('handles keyboard navigation', async () => {
      const user = userEvent.setup()
      
      render(
        <Dialog>
          <DialogTrigger>Open with Enter</DialogTrigger>
          <DialogContent>
            <DialogTitle>Keyboard Test</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      const trigger = screen.getByText('Open with Enter')
      trigger.focus()
      
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(screen.getByText('Keyboard Test')).toBeInTheDocument()
      })
    })
  })

  describe('Complex Dialog interactions', () => {
    it('handles nested dialogs', async () => {
      const user = userEvent.setup()
      
      render(
        <Dialog>
          <DialogTrigger>Open Parent</DialogTrigger>
          <DialogContent>
            <DialogTitle>Parent Dialog</DialogTitle>
            <Dialog>
              <DialogTrigger>Open Child</DialogTrigger>
              <DialogContent>
                <DialogTitle>Child Dialog</DialogTitle>
              </DialogContent>
            </Dialog>
          </DialogContent>
        </Dialog>
      )

      await user.click(screen.getByText('Open Parent'))
      expect(screen.getByText('Parent Dialog')).toBeInTheDocument()

      await user.click(screen.getByText('Open Child'))
      expect(screen.getByText('Child Dialog')).toBeInTheDocument()
    })

    it('maintains state after re-render', async () => {
      const user = userEvent.setup()
      let renderCount = 0
      
      const TestComponent = () => {
        renderCount++
        const [value, setValue] = React.useState('')
        
        return (
          <Dialog>
            <DialogTrigger>Open</DialogTrigger>
            <DialogContent>
              <input 
                value={value} 
                onChange={(e) => setValue(e.target.value)}
                data-testid="dialog-input"
              />
              <span>Render count: {renderCount}</span>
            </DialogContent>
          </Dialog>
        )
      }

      render(<TestComponent />)
      
      await user.click(screen.getByText('Open'))
      const input = screen.getByTestId('dialog-input')
      
      await user.type(input, 'Hello')
      expect(input).toHaveValue('Hello')
    })
  })
})