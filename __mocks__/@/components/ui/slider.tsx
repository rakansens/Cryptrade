export const Slider = ({ value, onValueChange, ...props }: any) => (
  <input 
    type="range" 
    value={value?.[0] || 0} 
    onChange={(e) => onValueChange?.([parseInt(e.target.value)])} 
    data-testid="slider"
    {...props}
  />
);