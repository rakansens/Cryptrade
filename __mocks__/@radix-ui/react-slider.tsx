import React from 'react';

export const Root = React.forwardRef<HTMLDivElement, any>(
  ({ value = [0], onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    const [currentValue, setCurrentValue] = React.useState(value);

    React.useEffect(() => {
      setCurrentValue(value);
    }, [value]);

    const handleValueChange = (newValue: number[]) => {
      setCurrentValue(newValue);
      onValueChange?.(newValue);
    };

    return (
      <div
        ref={ref}
        data-testid={props['data-testid'] || 'slider'}
        data-orientation="horizontal"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={currentValue[0]}
        {...props}
      >
        {React.Children.map(props.children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as any, {
              value: currentValue,
              onValueChange: handleValueChange,
              min,
              max,
              step
            });
          }
          return child;
        })}
      </div>
    );
  }
);
Root.displayName = 'Slider';

export const Track = React.forwardRef<HTMLDivElement, any>(
  (props, ref) => (
    <div
      ref={ref}
      data-testid="slider-track"
      {...props}
    />
  )
);
Track.displayName = 'SliderTrack';

export const Range = React.forwardRef<HTMLDivElement, any>(
  (props, ref) => (
    <div
      ref={ref}
      data-testid="slider-range"
      {...props}
    />
  )
);
Range.displayName = 'SliderRange';

export const Thumb = React.forwardRef<HTMLDivElement, any>(
  ({ index = 0, ...props }, ref) => (
    <div
      ref={ref}
      data-testid={`slider-thumb-${index}`}
      role="slider"
      tabIndex={0}
      {...props}
    />
  )
);
Thumb.displayName = 'SliderThumb';