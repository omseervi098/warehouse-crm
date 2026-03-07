
import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import Button from './Button';
import { useTheme } from '../../hooks/useTheme';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) => {
  const { theme } = useTheme();
  
  if (totalPages <= 1) {
    return null;
  }

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  
  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5; // Maximum number of page numbers to show
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if there are fewer than maxVisiblePages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate start and end of the middle section
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if we're near the start or end
      if (currentPage <= 3) {
        end = 4;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }
      
      // Add ellipsis if needed
      if (start > 2) {
        pages.push('...');
      }
      
      // Add middle pages
      for (let i = start; i <= end; i++) {
        if (i > 1 && i < totalPages) {
          pages.push(i);
        }
      }
      
      // Add ellipsis if needed
      if (end < totalPages - 1) {
        pages.push('...');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
  };
  
  const pageNumbers = getPageNumbers();

  return (
    <nav 
      className={`flex flex-col sm:flex-row items-center justify-between border-t ${theme.border.primary} ${theme.bg.card} px-4 py-3 sm:px-6 rounded-b-lg`}
      aria-label="Pagination"
    >
      {/* Info text */}
      <div className="mb-3 sm:mb-0">
        <p className={`text-sm ${theme.text.secondary}`}>
          Showing <span className="font-medium">{startItem}</span> to <span className="font-medium">{endItem}</span> of{' '}
          <span className="font-medium">{totalItems}</span> results
        </p>
      </div>
      
      {/* Page numbers */}
      <div className="flex items-center space-x-1">
        <Button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          variant="secondary"
          size="sm"
          className="px-2.5"
          aria-label="Previous page"
        >
          <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
        </Button>
        
        <div className="hidden sm:flex items-center space-x-1">
          {pageNumbers.map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className={`px-3 py-1.5 text-sm ${theme.text.muted}`}>
                  {page}
                </span>
              ) : (
                <button
                  onClick={() => onPageChange(Number(page))}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                    currentPage === page
                      ? 'bg-accent text-white'
                      : `${theme.text.secondary} hover:${theme.bg.hover}`
                  }`}
                  aria-current={currentPage === page ? 'page' : undefined}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
        
        <Button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          variant="secondary"
          size="sm"
          className="px-2.5"
          aria-label="Next page"
        >
          <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
          <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
};

export default Pagination;