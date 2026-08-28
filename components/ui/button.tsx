import type { ButtonHTMLAttributes, ReactNode } from 'react';

export default function Button({ variant = 'secondary', children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; children: ReactNode }) {
  return <button className={`ui-button ui-button-${variant} ${className}`.trim()} {...props}>{children}</button>;
}
