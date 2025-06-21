export const Switch = ({ checked, onCheckedChange, ...props }: any) => (
  <button
    role="switch"
    aria-checked={checked}
    data-testid="switch"
    onClick={() => onCheckedChange?.(!checked)}
    {...props}
  />
);