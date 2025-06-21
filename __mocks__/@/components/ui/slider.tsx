import React from 'react';

export const Slider = React.forwardRef<HTMLInputElement, any>(
  ({ value, onValueChange, ...props }, ref) => (
    <input 
      ref={ref}
      type="range" 
      value={value?.[0] || 0} 
      onChange={(e) => onValueChange?.([parseInt(e.target.value)])} 
      data-testid="slider"
      {...props}
    />
  )
);
Slider.displayName = 'Slider';