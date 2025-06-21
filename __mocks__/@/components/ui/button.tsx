export const Button = ({ children, onClick, ...props }: any) => (
  <button onClick={onClick} data-testid="button" {...props}>
    {children}
  </button>
);