import React from 'react';
import { StockTransactionType } from '../../types';

interface TransactionTypeBadgeProps {
  type: StockTransactionType;
}

const TransactionTypeBadge: React.FC<TransactionTypeBadgeProps> = ({ type }) => {
  const badgeStyles = {
    [StockTransactionType.INWARD]: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: 'I',
    },
    [StockTransactionType.OUTWARD]: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: 'O',
    },
    [StockTransactionType.RETURN]: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      label: 'R',
    },
  };

  const style = badgeStyles[type] || { bg: 'bg-slate-100', text: 'text-slate-800', label: 'Unknown' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
};

export default TransactionTypeBadge;
