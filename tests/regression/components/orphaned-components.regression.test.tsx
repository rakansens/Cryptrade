import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AlertForm } from '../../../components/alerts/AlertForm';
import { AlertList } from '../../../components/alerts/AlertList';
import { MainLayout } from '../../../components/MainLayout';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock dependencies
jest.mock('../../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('../../../store/alert.store', () => ({
  useAlertStore: () => ({
    alerts: [],
    addAlert: jest.fn(),
    removeAlert: jest.fn(),
    updateAlert: jest.fn(),
  }),
}));

describe('Orphaned Components Regression Tests', () => {
  describe('AlertForm Component', () => {
    const mockOnSubmit = jest.fn();
    const mockOnCancel = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should render alert form with all fields', () => {
      render(<AlertForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      expect(screen.getByLabelText(/symbol/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/condition/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create alert/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should handle form submission', async () => {
      render(<AlertForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const symbolInput = screen.getByLabelText(/symbol/i);
      const priceInput = screen.getByLabelText(/price/i);
      const submitButton = screen.getByRole('button', { name: /create alert/i });

      fireEvent.change(symbolInput, { target: { value: 'BTCUSDT' } });
      fireEvent.change(priceInput, { target: { value: '50000' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          symbol: 'BTCUSDT',
          price: 50000,
          condition: 'above',
          enabled: true,
        });
      });
    });

    it('should validate required fields', async () => {
      render(<AlertForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const submitButton = screen.getByRole('button', { name: /create alert/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });

    it('should handle cancel action', () => {
      render(<AlertForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should handle edit mode with initial values', () => {
      const initialAlert = {
        id: '1',
        symbol: 'ETHUSDT',
        price: 3000,
        condition: 'below' as const,
        enabled: false,
      };

      render(
        <AlertForm
          alert={initialAlert}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByDisplayValue('ETHUSDT')).toBeInTheDocument();
      expect(screen.getByDisplayValue('3000')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /update alert/i })).toBeInTheDocument();
    });
  });

  describe('AlertList Component', () => {
    const mockAlerts = [
      {
        id: '1',
        symbol: 'BTCUSDT',
        price: 50000,
        condition: 'above' as const,
        enabled: true,
        createdAt: new Date('2025-06-17T10:00:00Z'),
      },
      {
        id: '2',
        symbol: 'ETHUSDT',
        price: 3000,
        condition: 'below' as const,
        enabled: false,
        createdAt: new Date('2025-06-17T11:00:00Z'),
      },
    ];

    it('should render list of alerts', () => {
      render(<AlertList alerts={mockAlerts} />);

      expect(screen.getByText(/BTCUSDT/)).toBeInTheDocument();
      expect(screen.getByText(/ETHUSDT/)).toBeInTheDocument();
      expect(screen.getByText(/above \$50,000/i)).toBeInTheDocument();
      expect(screen.getByText(/below \$3,000/i)).toBeInTheDocument();
    });

    it('should show empty state when no alerts', () => {
      render(<AlertList alerts={[]} />);

      expect(screen.getByText(/no alerts configured/i)).toBeInTheDocument();
    });

    it('should handle alert actions', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      const mockOnToggle = jest.fn();

      render(
        <AlertList
          alerts={mockAlerts}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggle={mockOnToggle}
        />
      );

      // Test edit action
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      fireEvent.click(editButtons[0]);
      expect(mockOnEdit).toHaveBeenCalledWith(mockAlerts[0]);

      // Test delete action
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);
      expect(mockOnDelete).toHaveBeenCalledWith('1');

      // Test toggle action
      const toggleButtons = screen.getAllByRole('switch');
      fireEvent.click(toggleButtons[0]);
      expect(mockOnToggle).toHaveBeenCalledWith('1', false);
    });

    it('should display alert status correctly', () => {
      render(<AlertList alerts={mockAlerts} />);

      const toggles = screen.getAllByRole('switch');
      expect(toggles[0]).toBeChecked();
      expect(toggles[1]).not.toBeChecked();
    });
  });

  describe('MainLayout Component', () => {
    const mockChildren = <div data-testid="child-content">Test Content</div>;

    it('should render layout with children', () => {
      render(<MainLayout>{mockChildren}</MainLayout>);

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should render header and navigation', () => {
      render(<MainLayout>{mockChildren}</MainLayout>);

      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should handle responsive layout', () => {
      const { container } = render(<MainLayout>{mockChildren}</MainLayout>);

      // Check for responsive classes
      expect(container.querySelector('.flex')).toBeInTheDocument();
      expect(container.querySelector('.flex-col')).toBeInTheDocument();
    });

    it('should render sidebar toggle on mobile', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<MainLayout>{mockChildren}</MainLayout>);

      const toggleButton = screen.getByRole('button', { name: /menu/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('should handle sidebar state', () => {
      render(<MainLayout>{mockChildren}</MainLayout>);

      const toggleButton = screen.getByRole('button', { name: /menu/i });
      
      // Initially sidebar should be closed on mobile
      fireEvent.click(toggleButton);
      expect(screen.getByRole('complementary')).toHaveClass('translate-x-0');

      // Close sidebar
      fireEvent.click(toggleButton);
      expect(screen.getByRole('complementary')).toHaveClass('-translate-x-full');
    });

    it('should render with custom className', () => {
      const { container } = render(
        <MainLayout className="custom-layout">
          {mockChildren}
        </MainLayout>
      );

      expect(container.firstChild).toHaveClass('custom-layout');
    });

    it('should handle loading state', () => {
      render(<MainLayout loading>{mockChildren}</MainLayout>);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should handle error state', () => {
      const error = new Error('Test error');
      render(<MainLayout error={error}>{mockChildren}</MainLayout>);

      expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });
  });

  // Snapshot tests for current behavior
  describe('Component Snapshots', () => {
    it('should match AlertForm snapshot', () => {
      const { container } = render(
        <AlertForm onSubmit={jest.fn()} onCancel={jest.fn()} />
      );
      expect(container).toMatchSnapshot();
    });

    it('should match AlertList snapshot', () => {
      const { container } = render(
        <AlertList
          alerts={[
            {
              id: '1',
              symbol: 'BTCUSDT',
              price: 50000,
              condition: 'above',
              enabled: true,
              createdAt: new Date('2025-06-17T10:00:00Z'),
            },
          ]}
        />
      );
      expect(container).toMatchSnapshot();
    });

    it('should match MainLayout snapshot', () => {
      const { container } = render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );
      expect(container).toMatchSnapshot();
    });
  });
});