import React from 'react';
import { useTheme } from '../../hooks/useTheme';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  list?: string; // Added for datalist support
}

const Input: React.FC<InputProps> = ({ label, id, error, className, list, ...props }) => {
  const { theme } = useTheme();
  
  // Modern, high-contrast input styles with hover and focus states
  const inputClasses = `block w-full rounded-lg border py-2 px-3 ${theme.bg.input} ${theme.text.primary} shadow-sm transition-all duration-200 ${
    error 
      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' 
      : `${theme.border.primary} hover:${theme.border.secondary} focus:border-accent focus:ring-2 focus:ring-accent/20`
  } placeholder:${theme.text.muted} text-sm leading-6 ${className} disabled:opacity-60 disabled:cursor-not-allowed`;

  return (
    <div>
      {label && (
        <label 
          htmlFor={id} 
          className={`block text-sm font-medium leading-6 ${theme.text.secondary} mb-1.5`}
        >
          {label}
        </label>
      )}
      <div className="mt-2">
        <input id={id} className={inputClasses} list={list} {...props} />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
};


interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ label, id, error, children, className, ...props }) => {
  const { theme } = useTheme();
  
  // Consistent styling with Input component with hover and focus states
  const selectClasses = `block w-full appearance-none rounded-lg border py-2 px-3 ${theme.bg.input} ${theme.text.primary} shadow-sm transition-all duration-200 ${
    error 
      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' 
      : `${theme.border.primary} hover:${theme.border.secondary} focus:border-accent focus:ring-2 focus:ring-accent/20`
  } text-sm leading-6 cursor-pointer ${className} disabled:opacity-60 disabled:cursor-not-allowed`;

  return (
    <div>
      {label && (
        <label 
          htmlFor={id} 
          className={`block text-sm font-medium leading-6 ${theme.text.secondary} mb-1.5`}
        >
          {label}
        </label>
      )}
      <div className="mt-2">
        <select id={id} className={selectClasses} {...props}>
          {children}
        </select>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
};


interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, id, error, className, ...props }) => {
  const { theme } = useTheme();
  
  // Consistent styling with Input component with hover and focus states
  const textareaClasses = `block w-full rounded-lg border py-2 px-3 ${theme.bg.input} ${theme.text.primary} shadow-sm transition-all duration-200 ${
    error 
      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' 
      : `${theme.border.primary} hover:${theme.border.secondary} focus:border-accent focus:ring-2 focus:ring-accent/20`
  } placeholder:${theme.text.muted} text-sm leading-6 resize-y min-h-[100px] ${className} disabled:opacity-60 disabled:cursor-not-allowed`;
  
  return (
    <div>
      {label && (
        <label 
          htmlFor={id} 
          className={`block text-sm font-medium leading-6 ${theme.text.secondary} mb-1.5`}
        >
          {label}
        </label>
      )}
      <div className="mt-2">
        <textarea id={id} rows={3} className={textareaClasses} {...props} />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
};


export default Input;