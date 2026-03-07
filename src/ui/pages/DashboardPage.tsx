import React from 'react';
import PageHeader from '../components/common/PageHeader';
import { useAppContext } from '../contexts/AppContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { useTheme } from '../hooks/useTheme';

// const StatCard: React.FC<{title: string, value: string | number, subtext?: string}> = ({title, value, subtext}) => (
//   <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 hover:shadow-lg transition-shadow">
//     <h2 className="text-base font-medium text-slate-600 mb-1">{title}</h2>
//     <p className="text-4xl font-bold text-accent">{value}</p>
//     {subtext && <p className="text-sm text-slate-500">{subtext}</p>}
//   </div>
// );


const DashboardPage: React.FC = () => {
  const { theme } = useTheme();
  const { 
    // parties, 
    // items, 
    // stockTransactions, 
    companyProfile, 
    loading, 
    error 
  } = useAppContext();

  // Calculate statistics only when data is available
  // const stats = React.useMemo(() => {
  //   if (loading) return null;

  //   const totalInwardQuantity = stockTransactions
  //     .filter(t => t.transactionType === StockTransactionType.INWARD)
  //     .flatMap(t => t.items)
  //     .reduce((sum, item) => sum + item.quantity, 0);

  //   const totalOutwardQuantity = stockTransactions
  //     .filter(t => t.transactionType === StockTransactionType.OUTWARD)
  //     .flatMap(t => t.items)
  //     .reduce((sum, item) => sum + item.quantity, 0);
    
  //   return {
  //     totalInwardQuantity,
  //     totalOutwardQuantity,
  //     currentStockQuantity: totalInwardQuantity - totalOutwardQuantity,
  //     totalParties: parties.length,
  //     totalItems: items.length,
  //     totalTransactions: stockTransactions.length,
  //   };
  // }, [loading, stockTransactions, parties, items]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;
  }

  // if (!stats) return null;

  return (
    <div>
      <PageHeader 
        title={`Welcome to ${companyProfile?.warehouseName || 'Warehouse Management'}`}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* <StatCard title="Total Parties" value={stats.totalParties} />
        <StatCard title="Total Item Types" value={stats.totalItems} />
        <StatCard title="Total Transactions" value={stats.totalTransactions} />
        <StatCard 
          title="Current Stock" 
          value={stats.currentStockQuantity} 
          subtext="(Total Units)" 
        /> */}
      </div>
      <div className={`mt-8 ${theme.components.card} p-6 rounded-xl`}>
        <h2 className={`text-xl font-semibold ${theme.text.primary} mb-4`}>Quick Guide</h2>
        <p className={theme.text.secondary}>
          Use the sidebar to navigate through different sections of the application:
        </p>
        <ul className={`list-disc list-inside mt-3 ${theme.text.secondary} space-y-2`}>
          <li><strong>Company Profile:</strong> Update your warehouse details.</li>
          <li><strong>Items Master:</strong> Manage your inventory item types.</li>
          <li><strong>Parties:</strong> Manage client or supplier information.</li>
          <li><strong>Stock Entries:</strong> Record inward and outward material movements.</li>
          <li><strong>Stock Balance:</strong> View current stock levels for all items.</li>
          <li><strong>Warehouse Charges:</strong> Calculate and view warehousing charges.</li>
        </ul>
      </div>
    </div>
  );
};

export default DashboardPage;