import React, { ReactNode, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../hooks/useTheme';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) => {
  const { theme } = useTheme();
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  // Handle overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
  }[size];
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-200"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        ref={modalRef}
        className={`
          ${theme.bg.card} rounded-xl shadow-2xl w-full ${sizeClasses}
          transform transition-all duration-200 ease-out
          flex flex-col max-h-[90vh] max-w-[calc(100vw-2rem)]
          border ${theme.border.primary}
        `}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${theme.border.primary} flex-shrink-0`}>
          <h2 
            id="modal-title" 
            className={`text-lg font-semibold ${theme.text.primary}`}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full p-1.5 ${theme.text.muted} hover:${theme.bg.hover} hover:${theme.text.secondary} transition-colors hover:cursor-pointer`}
            aria-label="Close modal"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-grow p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className={`flex-shrink-0 px-6 py-4 ${theme.bg.secondary} border-t ${theme.border.primary} rounded-b-xl flex justify-end space-x-3`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;