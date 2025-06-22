import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

describe('Tabs Components', () => {
  const defaultTabs = () => (
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content 1</TabsContent>
      <TabsContent value="tab2">Content 2</TabsContent>
      <TabsContent value="tab3">Content 3</TabsContent>
    </Tabs>
  )

  describe('Tabs', () => {
    it('renders with default value', () => {
      render(defaultTabs())
      
      expect(screen.getByText('Tab 1')).toBeInTheDocument()
      expect(screen.getByText('Tab 2')).toBeInTheDocument()
      expect(screen.getByText('Tab 3')).toBeInTheDocument()
      expect(screen.getByText('Content 1')).toBeInTheDocument()
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument()
      expect(screen.queryByText('Content 3')).not.toBeInTheDocument()
    })

    it('switches tabs on click', async () => {
      const user = userEvent.setup()
      render(defaultTabs())

      expect(screen.getByText('Content 1')).toBeInTheDocument()
      
      await user.click(screen.getByText('Tab 2'))
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument()
      expect(screen.getByText('Content 2')).toBeInTheDocument()
      
      await user.click(screen.getByText('Tab 3'))
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument()
      expect(screen.getByText('Content 3')).toBeInTheDocument()
    })

    it('handles controlled mode', async () => {
      const user = userEvent.setup()
      const onValueChange = jest.fn()
      
      const { rerender } = render(
        <Tabs value="tab1" onValueChange={onValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      )

      await user.click(screen.getByText('Tab 2'))
      expect(onValueChange).toHaveBeenCalledWith('tab2')

      rerender(
        <Tabs value="tab2" onValueChange={onValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      )

      expect(screen.getByText('Content 2')).toBeInTheDocument()
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(
        <Tabs defaultValue="tab1" className="custom-tabs">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      )

      const tabsContainer = screen.getByText('Tab 1').closest('[data-orientation]')
      expect(tabsContainer).toHaveClass('custom-tabs')
    })

    it('supports different orientations', () => {
      const { rerender } = render(
        <Tabs defaultValue="tab1" orientation="horizontal">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      )

      let tabsContainer = screen.getByText('Tab 1').closest('[data-orientation]')
      expect(tabsContainer).toHaveAttribute('data-orientation', 'horizontal')

      rerender(
        <Tabs defaultValue="tab1" orientation="vertical">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      )

      tabsContainer = screen.getByText('Tab 1').closest('[data-orientation]')
      expect(tabsContainer).toHaveAttribute('data-orientation', 'vertical')
    })
  })

  describe('TabsList', () => {
    it('renders with correct styles', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      const tabsList = screen.getByRole('tablist')
      expect(tabsList).toHaveClass(
        'inline-flex',
        'h-10',
        'items-center',
        'justify-center',
        'rounded-md',
        'bg-muted',
        'p-1'
      )
    })

    it('applies custom className', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList className="custom-list">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      const tabsList = screen.getByRole('tablist')
      expect(tabsList).toHaveClass('custom-list')
    })
  })

  describe('TabsTrigger', () => {
    it('renders with correct ARIA attributes', () => {
      render(defaultTabs())

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' })
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' })

      expect(tab1).toHaveAttribute('aria-selected', 'true')
      expect(tab2).toHaveAttribute('aria-selected', 'false')
      expect(tab1).toHaveAttribute('data-state', 'active')
      expect(tab2).toHaveAttribute('data-state', 'inactive')
    })

    it('handles disabled state', async () => {
      const user = userEvent.setup()
      const onValueChange = jest.fn()

      render(
        <Tabs defaultValue="tab1" onValueChange={onValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" disabled>Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      )

      const disabledTab = screen.getByText('Tab 2')
      expect(disabledTab).toHaveAttribute('data-disabled')
      expect(disabledTab).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50')

      await user.click(disabledTab)
      expect(onValueChange).not.toHaveBeenCalled()
    })

    it('applies active styles correctly', () => {
      render(defaultTabs())

      const activeTab = screen.getByRole('tab', { name: 'Tab 1' })
      const inactiveTab = screen.getByRole('tab', { name: 'Tab 2' })

      expect(activeTab).toHaveAttribute('data-state', 'active')
      expect(activeTab).toHaveClass('bg-background', 'text-foreground', 'shadow-sm')
      
      expect(inactiveTab).toHaveAttribute('data-state', 'inactive')
      expect(inactiveTab).toHaveClass('text-muted-foreground')
      expect(inactiveTab).not.toHaveClass('bg-background')
    })

    it('handles keyboard navigation', async () => {
      const user = userEvent.setup()
      render(defaultTabs())

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' })
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' })
      const tab3 = screen.getByRole('tab', { name: 'Tab 3' })

      tab1.focus()
      expect(tab1).toHaveFocus()

      await user.keyboard('{ArrowRight}')
      expect(tab2).toHaveFocus()

      await user.keyboard('{ArrowRight}')
      expect(tab3).toHaveFocus()

      await user.keyboard('{ArrowRight}')
      expect(tab1).toHaveFocus() // Should wrap around

      await user.keyboard('{ArrowLeft}')
      expect(tab3).toHaveFocus() // Should wrap around backwards
    })
  })

  describe('TabsContent', () => {
    it('only shows content for active tab', () => {
      render(defaultTabs())

      const content1 = screen.getByText('Content 1')
      const content2Container = screen.queryByText('Content 2')
      const content3Container = screen.queryByText('Content 3')

      expect(content1).toBeVisible()
      expect(content2Container).not.toBeInTheDocument()
      expect(content3Container).not.toBeInTheDocument()
    })

    it('applies correct ARIA attributes', () => {
      render(defaultTabs())

      const content1 = screen.getByTestId('tab-content-tab1')
      expect(content1).toHaveAttribute('role', 'tabpanel')
      expect(content1).toHaveAttribute('aria-labelledby', 'trigger-tab1')
      expect(content1).toHaveAttribute('tabindex', '0')
    })

    it('applies custom className', async () => {
      const user = userEvent.setup()
      
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" className="custom-content-1">
            Content 1
          </TabsContent>
          <TabsContent value="tab2" className="custom-content-2">
            Content 2
          </TabsContent>
        </Tabs>
      )

      expect(screen.getByTestId('tab-content-tab1')).toHaveClass('custom-content-1')

      await user.click(screen.getByText('Tab 2'))
      expect(screen.getByTestId('tab-content-tab2')).toHaveClass('custom-content-2')
    })

    it('maintains focus management', async () => {
      const user = userEvent.setup()
      
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <button>Button in Tab 1</button>
          </TabsContent>
          <TabsContent value="tab2">
            <button>Button in Tab 2</button>
          </TabsContent>
        </Tabs>
      )

      await user.click(screen.getByText('Tab 2'))
      const tab2Content = screen.getByText('Button in Tab 2').parentElement
      expect(tab2Content).toHaveAttribute('data-state', 'active')
    })
  })

  describe('Complex scenarios', () => {
    it('handles dynamic tabs', async () => {
      const user = userEvent.setup()
      
      const DynamicTabs = () => {
        const [tabs, setTabs] = React.useState(['tab1', 'tab2'])
        
        return (
          <>
            <button onClick={() => setTabs([...tabs, `tab${tabs.length + 1}`])}>
              Add Tab
            </button>
            <Tabs defaultValue="tab1">
              <TabsList>
                {tabs.map(tab => (
                  <TabsTrigger key={tab} value={tab}>
                    {tab.toUpperCase()}
                  </TabsTrigger>
                ))}
              </TabsList>
              {tabs.map(tab => (
                <TabsContent key={tab} value={tab}>
                  Content for {tab}
                </TabsContent>
              ))}
            </Tabs>
          </>
        )
      }

      render(<DynamicTabs />)

      expect(screen.getByText('TAB1')).toBeInTheDocument()
      expect(screen.getByText('TAB2')).toBeInTheDocument()

      await user.click(screen.getByText('Add Tab'))
      expect(screen.getByText('TAB3')).toBeInTheDocument()

      await user.click(screen.getByText('TAB3'))
      expect(screen.getByText('Content for tab3')).toBeInTheDocument()
    })

    it('preserves tab state during re-renders', () => {
      const { rerender } = render(
        <Tabs defaultValue="tab2">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      )

      expect(screen.getByText('Content 2')).toBeInTheDocument()

      rerender(
        <Tabs defaultValue="tab2">
          <TabsList>
            <TabsTrigger value="tab1">Updated Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Updated Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Updated Content 1</TabsContent>
          <TabsContent value="tab2">Updated Content 2</TabsContent>
        </Tabs>
      )

      expect(screen.getByText('Updated Content 2')).toBeInTheDocument()
      expect(screen.queryByText('Updated Content 1')).not.toBeInTheDocument()
    })
  })
})