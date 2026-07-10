
import React from 'react';
import { useTheme } from '../../hooks/useTheme';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const { theme } = useTheme();
  
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-lg shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all ease-in-out duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';
  
  let variantStyles = '';
  switch (variant) {
    case 'primary':
      variantStyles = 'bg-accent hover:bg-accent-hover text-white focus-visible:ring-accent active:bg-accent-hover/90';
      break;
    case 'secondary':
      variantStyles = `${theme.bg.secondary} ${theme.text.primary} hover:${theme.bg.tertiary} focus-visible:ring-slate-300 active:${theme.bg.secondary}/90 border ${theme.border.primary}`;
      break;
    case 'danger':
      variantStyles = 'bg-red-600 hover:bg-red-700 text-white focus-visible:ring-red-500 active:bg-red-700/90';
      break;
  }

  let sizeStyles = '';
  switch (size) {
    case 'xs':
      sizeStyles = 'px-2 py-1 text-xs';
      break;
    case 'sm':
      sizeStyles = 'px-2.5 py-1 text-xs';
      break;
    case 'md':
      sizeStyles = 'px-3 py-1.5 text-sm';
      break;
    case 'lg':
      sizeStyles = 'px-4 py-3 text-base';
      break;
  }

  return (
    <button
      type="button"
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;