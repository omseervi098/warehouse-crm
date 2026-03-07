import React from 'react';

type SpinnerSize = 'small' | 'medium' | 'large';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

const sizeMap = {
  small: 'h-5 w-5 border-2',
  medium: 'h-8 w-8 border-2',
  large: 'h-12 w-12 border-4',
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium',
  className = '' 
}) => {
  const spinnerSize = sizeMap[size] || sizeMap.medium;
  
  return (
    <div className={`inline-block ${className}`}>
      <div 
        className={`${spinnerSize} animate-spin rounded-full border-t-2 border-b-2 border-accent`}
        role="status"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
};

export default LoadingSpinner;
