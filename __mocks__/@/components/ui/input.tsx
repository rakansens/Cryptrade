export const Input = ({ onChange, ...props }: any) => (
  <input onChange={onChange} data-testid="input" {...props} />
);