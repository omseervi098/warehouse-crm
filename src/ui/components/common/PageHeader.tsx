
import React from 'react';
import { useTheme } from '../../hooks/useTheme';

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, children }) => {
  const { theme } = useTheme();
  
  return (
    <div className={`mb-8 pb-4 border-b ${theme.border.primary} flex justify-between items-center`}>
      <h1 className={`text-2xl font-bold ${theme.text.primary} tracking-tight`}>{title}</h1>
      <div>{children}</div>
    </div>
  );
};

export default PageHeader;