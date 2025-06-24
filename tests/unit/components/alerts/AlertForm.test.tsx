import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertForm } from '@/components/alerts/AlertForm';
import { useAlerts } from '@/hooks/use-alerts';

// Mock dependencies
jest.mock('@/hooks/use-alerts');

describe('AlertForm', () => {
  const mockCreateAlert = jest.fn();
  const mockUseAlerts = {
    createAlert: mockCreateAlert,
    alerts: [],
    loading: false,
    error: null,
    deleteAlert: jest.fn(),
    updateAlert: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAlerts as jest.Mock).mockReturnValue(mockUseAlerts);
  });

  it('should render alert form with input fields', () => {
    render(<AlertForm userId="user-123" />);
    
    expect(screen.getByPlaceholderText('Symbol')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Price above')).toBeInTheDocument();
    expect(screen.getByText('Create Alert')).toBeInTheDocument();
  });

  it('should update symbol input value', async () => {
    const user = userEvent.setup();
    render(<AlertForm userId="user-123" />);
    
    const symbolInput = screen.getByPlaceholderText('Symbol');
    await user.type(symbolInput, 'BTCUSDT');
    
    expect(symbolInput).toHaveValue('BTCUSDT');
  });

  it('should update price input value', async () => {
    const user = userEvent.setup();
    render(<AlertForm userId="user-123" />);
    
    const priceInput = screen.getByPlaceholderText('Price above');
    await user.type(priceInput, '50000');
    
    expect(priceInput).toHaveValue('50000');
  });

  it('should create alert with valid inputs', async () => {
    const user = userEvent.setup();
    mockCreateAlert.mockResolvedValueOnce({ success: true });
    
    render(<AlertForm userId="user-123" />);
    
    const symbolInput = screen.getByPlaceholderText('Symbol');
    const priceInput = screen.getByPlaceholderText('Price above');
    const createButton = screen.getByText('Create Alert');
    
    await user.type(symbolInput, 'ETHUSDT');
    await user.type(priceInput, '3000');
    
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockCreateAlert).toHaveBeenCalledWith('ETHUSDT', { priceAbove: 3000 });
    });
  });

  it('should clear form after successful alert creation', async () => {
    const user = userEvent.setup();
    mockCreateAlert.mockResolvedValueOnce({ success: true });
    
    render(<AlertForm userId="user-123" />);
    
    const symbolInput = screen.getByPlaceholderText('Symbol') as HTMLInputElement;
    const priceInput = screen.getByPlaceholderText('Price above') as HTMLInputElement;
    const createButton = screen.getByText('Create Alert');
    
    await user.type(symbolInput, 'BNBUSDT');
    await user.type(priceInput, '500');
    
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(symbolInput.value).toBe('');
      expect(priceInput.value).toBe('');
    });
  });

  it('should handle decimal price values', async () => {
    const user = userEvent.setup();
    mockCreateAlert.mockResolvedValueOnce({ success: true });
    
    render(<AlertForm userId="user-123" />);
    
    const symbolInput = screen.getByPlaceholderText('Symbol');
    const priceInput = screen.getByPlaceholderText('Price above');
    const createButton = screen.getByText('Create Alert');
    
    await user.type(symbolInput, 'BTCUSDT');
    await user.type(priceInput, '45678.90');
    
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockCreateAlert).toHaveBeenCalledWith('BTCUSDT', { priceAbove: 45678.90 });
    });
  });

  it('should handle empty symbol input', async () => {
    const user = userEvent.setup();
    render(<AlertForm userId="user-123" />);
    
    const priceInput = screen.getByPlaceholderText('Price above');
    const createButton = screen.getByText('Create Alert');
    
    await user.type(priceInput, '1000');
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockCreateAlert).toHaveBeenCalledWith('', { priceAbove: 1000 });
    });
  });

  it('should handle empty price input', async () => {
    const user = userEvent.setup();
    render(<AlertForm userId="user-123" />);
    
    const symbolInput = screen.getByPlaceholderText('Symbol');
    const createButton = screen.getByText('Create Alert');
    
    await user.type(symbolInput, 'ETHUSDT');
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockCreateAlert).toHaveBeenCalledWith('ETHUSDT', { priceAbove: NaN });
    });
  });

  it('should handle invalid price input', async () => {
    const user = userEvent.setup();
    render(<AlertForm userId="user-123" />);
    
    const symbolInput = screen.getByPlaceholderText('Symbol');
    const priceInput = screen.getByPlaceholderText('Price above');
    const createButton = screen.getByText('Create Alert');
    
    await user.type(symbolInput, 'BTCUSDT');
    await user.type(priceInput, 'invalid');
    
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockCreateAlert).toHaveBeenCalledWith('BTCUSDT', { priceAbove: NaN });
    });
  });

  it('should handle createAlert error', async () => {
    const user = userEvent.setup();
    mockCreateAlert.mockRejectedValueOnce(new Error('Failed to create alert'));
    
    render(<AlertForm userId="user-123" />);
    
    const symbolInput = screen.getByPlaceholderText('Symbol');
    const priceInput = screen.getByPlaceholderText('Price above');
    const createButton = screen.getByText('Create Alert');
    
    await user.type(symbolInput, 'BTCUSDT');
    await user.type(priceInput, '50000');
    
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockCreateAlert).toHaveBeenCalledWith('BTCUSDT', { priceAbove: 50000 });
    });
    
    // Form should not be cleared on error
    expect(symbolInput).toHaveValue('BTCUSDT');
    expect(priceInput).toHaveValue('50000');
  });

  it('should pass userId to useAlerts hook', () => {
    render(<AlertForm userId="test-user-456" />);
    
    expect(useAlerts).toHaveBeenCalledWith('test-user-456');
  });

  it('should handle multiple alert creations', async () => {
    const user = userEvent.setup();
    mockCreateAlert.mockResolvedValue({ success: true });
    
    render(<AlertForm userId="user-123" />);
    
    const symbolInput = screen.getByPlaceholderText('Symbol');
    const priceInput = screen.getByPlaceholderText('Price above');
    const createButton = screen.getByText('Create Alert');
    
    // First alert
    await user.type(symbolInput, 'BTCUSDT');
    await user.type(priceInput, '50000');
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockCreateAlert).toHaveBeenCalledWith('BTCUSDT', { priceAbove: 50000 });
    });
    
    // Wait for form to clear
    await waitFor(() => {
      expect(symbolInput).toHaveValue('');
      expect(priceInput).toHaveValue('');
    });
    
    // Second alert
    await user.type(symbolInput, 'ETHUSDT');
    await user.type(priceInput, '3000');
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockCreateAlert).toHaveBeenCalledWith('ETHUSDT', { priceAbove: 3000 });
    });
    
    expect(mockCreateAlert).toHaveBeenCalledTimes(2);
  });

  it('should handle spaces in symbol input', async () => {
    const user = userEvent.setup();
    mockCreateAlert.mockResolvedValueOnce({ success: true });
    
    render(<AlertForm userId="user-123" />);
    
    const symbolInput = screen.getByPlaceholderText('Symbol');
    const priceInput = screen.getByPlaceholderText('Price above');
    const createButton = screen.getByText('Create Alert');
    
    await user.type(symbolInput, '  BTCUSDT  ');
    await user.type(priceInput, '50000');
    
    fireEvent.click(createButton);
    
    await waitFor(() => {
      // Note: The current implementation doesn't trim spaces
      expect(mockCreateAlert).toHaveBeenCalledWith('  BTCUSDT  ', { priceAbove: 50000 });
    });
  });

  it('should handle very large price values', async () => {
    const user = userEvent.setup();
    mockCreateAlert.mockResolvedValueOnce({ success: true });
    
    render(<AlertForm userId="user-123" />);
    
    const symbolInput = screen.getByPlaceholderText('Symbol');
    const priceInput = screen.getByPlaceholderText('Price above');
    const createButton = screen.getByText('Create Alert');
    
    await user.type(symbolInput, 'BTCUSDT');
    await user.type(priceInput, '999999999.99');
    
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockCreateAlert).toHaveBeenCalledWith('BTCUSDT', { priceAbove: 999999999.99 });
    });
  });

  it('should handle negative price values', async () => {
    const user = userEvent.setup();
    mockCreateAlert.mockResolvedValueOnce({ success: true });
    
    render(<AlertForm userId="user-123" />);
    
    const symbolInput = screen.getByPlaceholderText('Symbol');
    const priceInput = screen.getByPlaceholderText('Price above');
    const createButton = screen.getByText('Create Alert');
    
    await user.type(symbolInput, 'BTCUSDT');
    await user.type(priceInput, '-100');
    
    fireEvent.click(createButton);
    
    await waitFor(() => {
      // Note: The current implementation doesn't validate negative prices
      expect(mockCreateAlert).toHaveBeenCalledWith('BTCUSDT', { priceAbove: -100 });
    });
  });
});