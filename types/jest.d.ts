/// <reference types="jest" />
import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHTML(html: string): R;
      toHaveAttribute(attr: string, value?: unknown): R;
      toHaveClass(...classNames: string[]): R;
      toHaveFocus(): R;
      toHaveFormValues(expectedValues: Record<string, unknown>): R;
      toHaveStyle(css: string | Record<string, unknown>): R;
      toHaveTextContent(
        text: string | RegExp,
        options?: { normalizeWhitespace: boolean }
      ): R;
      toHaveValue(value?: string | string[] | number): R;
      toBeChecked(): R;
      toBeDisabled(): R;
      toBeEmpty(): R;
      toBeEnabled(): R;
      toBeInvalid(): R;
      toBeRequired(): R;
      toBeValid(): R;
      toBeVisible(): R;
      toHaveDescription(text?: string | RegExp): R;
      toHaveDisplayValue(
        value: string | RegExp | Array<string | RegExp>
      ): R;
      toHaveAccessibleDescription(text?: string | RegExp): R;
      toHaveAccessibleName(text?: string | RegExp): R;
      toHaveErrorMessage(text?: string | RegExp): R;
    }
  }
}