import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { SortConfig, StockBalance } from '../../types';
import { getDisplayLotNumber } from '../../utils/lotNumber';
import { SortIndicator } from '../common/Table';

interface StockBalanceTableProps {
    stockBalances: StockBalance[];
    sortConfig: SortConfig;
    requestSort: (key: string) => void;
    loading: boolean;
    onRowClick?: (balance: StockBalance) => void;
}

const StockBalanceTable: React.FC<StockBalanceTableProps> = (
    {
        stockBalances,
        sortConfig,
        requestSort,
        loading,
        onRowClick,
    }) => {
    const { theme } = useTheme();



    if (loading) {
        return (
            <div className="flex justify-center items-center py-8">
                <div
                    className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            </div>
        );
    }

    if (stockBalances.length === 0) {
        return (
            <div className={`text-center py-8 ${theme.text.muted}`}>
                <p>Record inward entries to see stock balances.</p>
                <p className="text-xs mt-2">Your filter criteria returned no
                    stock balances. Try expanding your search.</p>
            </div>
        );
    }

    return (
        <div
            className={`responsive-table-wrapper ${theme.bg.card} border ${theme.border.primary} rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 text-xs`}>
            <div className=" rounded-xl">
                <table
                    className={`min-w-full divide-y ${theme.border.primary} responsive-table border-collapse border ${theme.border.primary}`}>
                    <thead
                        className={`bg-gradient-to-r ${theme.bg.secondary} to-${theme.bg.secondary}/80 border-b ${theme.border.secondary}`}>
                        <tr className={`hover:${theme.bg.hover} transition-colors duration-150`}>
                            <th
                                onClick={() => requestSort('earliestEntryAt')}
                                className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                            >
                                <div className="flex items-center">
                                    Inward Dates
                                    <SortIndicator direction={sortConfig?.key === 'earliestEntryAt' ? sortConfig.direction : null} />
                                </div>
                            </th>
                            <th
                                onClick={() => requestSort('party.name')}
                                className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                            >
                                <div className="flex items-center">
                                    Party
                                    <SortIndicator direction={sortConfig?.key === 'party.name' ? sortConfig.direction : null} />
                                </div>
                            </th>
                            <th
                                onClick={() => requestSort('item.name')}
                                className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                            >
                                <div className="flex items-center">
                                    Item Name
                                    <SortIndicator direction={sortConfig?.key === 'item.name' ? sortConfig.direction : null} />
                                </div>
                            </th>
                            <th
                                onClick={() => requestSort('item.category')}
                                className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                            >
                                <div className="flex items-center">
                                    Category

                                    <SortIndicator direction={sortConfig?.key === 'item.category' ? sortConfig.direction : null} />
                                </div>
                            </th>
                            <th
                                onClick={() => requestSort('lotNumber')}
                                className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                            >
                                <div className="flex items-center">
                                    Lot Number
                                    <SortIndicator direction={sortConfig?.key === 'lotNumber' ? sortConfig.direction : null} />
                                </div>
                            </th>
                            <th
                                onClick={() => requestSort('unit.name')}
                                className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                            >
                                <div className="flex items-center">
                                    Packing
                                    <SortIndicator direction={sortConfig?.key === 'unit.name' ? sortConfig.direction : null} />
                                </div>
                            </th>
                            <th
                                onClick={() => requestSort('quantity')}
                                className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 text-right border-r ${theme.border.primary}`}
                            >
                                <div className="flex items-center justify-end">
                                    Current Stock
                                    <SortIndicator direction={sortConfig?.key === 'quantity' ? sortConfig.direction : null} />
                                </div>
                            </th>

                        </tr>
                    </thead>
                    <tbody className={`divide-y ${theme.border.primary}`}>
                        {stockBalances.length !== 0 && stockBalances.map((balance, index) => (
                            <tr
                                key={`${balance.item._id}-${balance.lotNumber}-${balance.party._id}-${index}`}
                                className={`group hover:${theme.bg.hover} transition-all duration-150 ease-in-out cursor-pointer border-b ${theme.border.primary} last:border-0 text-xs`}
                                onClick={() => onRowClick?.(balance)}
                            >
                                <td
                                    data-label="Inward Dates"
                                    className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.secondary} border-r ${theme.border.primary}`}
                                >
                                    <div>
                                        {balance.inwardDates.map((date) => date.split('T')[0].split('-').reverse().join('/')).join(', ')}
                                        {balance.isNil && balance.latestEntryAt && (
                                            <div className="text-[10px] text-red-500 mt-1 font-semibold">
                                                Nil Date: {new Date(balance.latestEntryAt).toLocaleDateString('en-GB')}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td
                                    data-label="Party"
                                    className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.primary} font-medium border-r ${theme.border.primary}`}
                                    title={balance.party.name}
                                >
                                    <div
                                        className="truncate max-w-[180px]">{balance.party.name}</div>
                                </td>
                                <td
                                    data-label="Item Name"
                                    className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.primary} font-semibold group-hover:text-accent-600 transition-colors duration-150 border-r ${theme.border.primary}`}
                                    title={balance.item.name}
                                >
                                    <div
                                        className="truncate max-w-[200px]">{balance.item.name}</div>
                                </td>
                                <td
                                    data-label="Category"
                                    className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.secondary} border-r ${theme.border.primary}`}
                                >
                                    {balance.item.category || 'N/A'}
                                </td>
                                <td
                                    data-label="Lot Number"
                                    className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.secondary} border-r ${theme.border.primary}`}
                                >
                                    {getDisplayLotNumber(balance.lotNumber)}
                                </td>
                                <td
                                    data-label="Packing"
                                    className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.secondary} border-r ${theme.border.primary}`}
                                >
                                    {balance.unit.name}
                                </td>
                                <td
                                    data-label="Current Stock"
                                    className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.primary} font-medium text-right border-r ${theme.border.primary}`}
                                >
                                    <div
                                        className={`inline-flex items-center justify-end min-w-[60px] px-2.5 py-1 rounded-md ${theme.bg.secondary} group-hover:${theme.bg.tertiary} transition-colors duration-150`}>
                                        <span
                                            className={theme.text.primary}>{balance.quantity}</span>
                                    </div>
                                </td>

                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StockBalanceTable;