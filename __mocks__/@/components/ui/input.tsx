import React from 'react';

export const Input = React.forwardRef<HTMLInputElement, any>(
  ({ onChange, ...props }, ref) => (
    <input ref={ref} onChange={onChange} data-testid="input" {...props} />
  )
);
Input.displayName = 'Input';