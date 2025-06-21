import React from 'react';

export const Root = React.forwardRef<HTMLButtonElement, any>(
  ({ checked, onCheckedChange, defaultChecked, disabled, ...props }, ref) => {
    const [isChecked, setIsChecked] = React.useState(
      checked ?? defaultChecked ?? false
    );

    React.useEffect(() => {
      if (checked !== undefined) {
        setIsChecked(checked);
      }
    }, [checked]);

    const handleClick = () => {
      if (!disabled) {
        const newChecked = !isChecked;
        setIsChecked(newChecked);
        onCheckedChange?.(newChecked);
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isChecked}
        data-state={isChecked ? 'checked' : 'unchecked'}
        data-testid={props['data-testid'] || 'switch'}
        disabled={disabled}
        onClick={handleClick}
        {...props}
      />
    );
  }
);
Root.displayName = 'Switch';

export const Thumb = React.forwardRef<HTMLSpanElement, any>(
  (props, ref) => (
    <span
      ref={ref}
      data-testid="switch-thumb"
      {...props}
    />
  )
);
Thumb.displayName = 'SwitchThumb';