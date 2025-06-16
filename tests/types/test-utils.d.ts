// Test utility types for component tests
import { ReactElement, ReactNode } from 'react';
import { RenderOptions, RenderResult } from '@testing-library/react';

// Mock component props types
export interface MockComponentProps {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  [key: string]: any;
}

// Enhanced render function type
export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  wrapper?: React.ComponentType<{ children: ReactNode }>;
}

// Jest mock types
export type MockedFunction<T extends (...args: any[]) => any> = jest.MockedFunction<T>;
export type MockedObject<T> = jest.Mocked<T>;

// Common test prop types
export interface TestButtonProps extends MockComponentProps {
  variant?: string;
  size?: string;
  title?: string;
}

export interface TestSelectProps extends MockComponentProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
}

export interface TestInputProps extends MockComponentProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
}

// Store mock types
export interface MockChartStore {
  symbol: string;
  timeframe: string;
  setSymbol: jest.Mock;
  setTimeframe: jest.Mock;
  indicators: {
    ma: boolean;
    rsi: boolean;
    macd: boolean;
    boll: boolean;
  };
  settings?: {
    boll?: Record<string, any>;
  };
  setChartReady?: jest.Mock;
}

export interface MockChatStore {
  sessions: Record<string, any>;
  currentSessionId: string;
  messages: any[];
  inputValue: string;
  isInputFromHomeScreen: boolean;
  isStreaming: boolean;
  isLoading: boolean;
  setInputValue: jest.Mock;
  createSession: jest.Mock;
  error: string | null;
}

// Hook mock return types
export interface MockUseChartReturn extends MockChartStore {}

export interface MockUseCandlestickDataReturn {
  priceData: any[];
  isLoading: boolean;
}

export interface MockUseIndicatorValuesReturn {
  ma7?: number;
  ma25?: number;
  ma99?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
}

// Component ref types
export interface ChartRef {
  fitContent: () => void;
}

// Event handler types
export interface ChartEventHandlers {
  fitContent: () => void;
  zoomIn?: (factor?: number) => void;
  zoomOut?: (factor?: number) => void;
  resetView?: () => void;
  drawingManager?: any;
  chartData?: any[];
  patternRenderer?: any;
  getPatternRenderer?: () => any;
}