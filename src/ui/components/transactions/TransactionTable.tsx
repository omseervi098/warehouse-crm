import { DoorOpen } from 'lucide-react';
import React from 'react';
import { useNotify } from '../../hooks/useNotify';
import { useTheme } from '../../hooks/useTheme';
import { GatepassData, SortConfig, StockTransaction } from '../../types';
import { transactionsApi } from '../../utils/api';
import { downloadGatepassPdf } from '../../utils/exportpdf';
import { getDisplayLotNumber } from '../../utils/lotNumber';
import Button from '../common/Button';
import { EditIcon, TableDeleteIcon } from '../common/Icons';
import { SortIndicator } from '../common/Table';
import TransactionTypeBadge from './TransactionTypeBadge';
type TransactionTableColumn =
  | 'enteredAt'
  | 'type'
  | 'party'
  | 'item'
  | 'lotNumber'
  | 'quantity'
  | 'short & extra'
  | 'unit'
  | 'vehicleNumber'
  | 'doNumber'
  | 'warehouse'
  | 'remark'
  | 'actions';

interface TransactionTableProps {
  entries: StockTransaction[];
  sortConfig: SortConfig | null;
  requestSort: (key: string) => void;
  onEdit: (transactionId: string) => void;
  onDelete: (transactionId: string) => void;
  tableType: 'inward' | 'outward-return';
  hiddenColumns?: TransactionTableColumn[];
}

const TransactionTable: React.FC<TransactionTableProps> = ({
  entries,
  sortConfig,
  requestSort,
  onEdit,
  onDelete,
  tableType,
  hiddenColumns,
}) => {
  const { theme } = useTheme();
  const notify = useNotify();
  const isHidden = (col: TransactionTableColumn) => hiddenColumns?.includes(col);
  const onDownload = async (batchId: string) => {
    try {
      const response = await transactionsApi.getGatepassData(batchId);
      const gatepassData: GatepassData = response.data;
      await downloadGatepassPdf(gatepassData);
    } catch (pdfError) {
      console.error("Failed to generate gatepass PDF:", pdfError);
      notify({ type: 'error', message: 'Transaction saved, but failed to generate Gatepass PDF.' });
    }
  }
  return (
    <div className={`responsive-table-wrapper ${theme.bg.card} border ${theme.border.primary} rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 text-xs`}>
      <div className=" rounded-xl">
        <table className={`min-w-full divide-y ${theme.border.primary} responsive-table border-collapse border ${theme.border.primary}`}>
          <thead className={`bg-gradient-to-r ${theme.bg.secondary} to-${theme.bg.secondary}/80 border-b ${theme.border.secondary}`}>
            <tr className={`hover:${theme.bg.hover} transition-colors duration-150`}>
              {!isHidden('enteredAt') && (
                <th
                  onClick={() => requestSort('enteredAt')}
                  className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                >
                  <div className="flex items-center">
                    Date & Time
                    <SortIndicator direction={sortConfig?.key === 'enteredAt' ? sortConfig.direction : null} />
                  </div>
                </th>
              )}
              {!isHidden('type') && (
                <th
                  onClick={() => requestSort('type')}
                  className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                >
                  <div className="flex items-center">
                    Type
                    <SortIndicator direction={sortConfig?.key === 'type' ? sortConfig.direction : null} />
                  </div>
                </th>
              )}
              {!isHidden('party') && (
                <th
                  onClick={() => requestSort('party.name')}
                  className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                >
                  <div className="flex items-center justify-center">
                    Party
                    <SortIndicator direction={sortConfig?.key === 'party.name' ? sortConfig.direction : null} />
                  </div>
                </th>
              )}
              {!isHidden('item') && (
                <th
                  onClick={() => requestSort('item.name')}
                  className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                >
                  <div className="flex items-center justify-center">
                    Item
                    <SortIndicator direction={sortConfig?.key === 'item.name' ? sortConfig.direction : null} />
                  </div>
                </th>
              )}
              {!isHidden('lotNumber') && (
                <th
                  onClick={() => requestSort('lotNumber')}
                  className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                >
                  <div className="flex items-center justify-center">
                    Lot
                    <SortIndicator direction={sortConfig?.key === 'lotNumber' ? sortConfig.direction : null} />
                  </div>
                </th>
              )}
              {!isHidden('quantity') && (
                <th
                  onClick={() => requestSort('quantity')}
                  className={`px-1 py-2 text-xs font-medium ${theme.text.muted} uppercase tracking-wider cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 text-center border-r ${theme.border.primary}`}
                >
                  <div className="flex items-center justify-center">
                    Qty
                    <SortIndicator direction={sortConfig?.key === 'quantity' ? sortConfig.direction : null} />
                  </div>
                </th>
              )}
              {tableType === 'inward' && !isHidden('short & extra') && (
                <th
                  className={`px-1 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                >
                  <div className="flex items-center justify-center">
                    Shortage & Extra
                  </div>
                </th>
              )}
              {!isHidden('unit') && (
                <th
                  onClick={() => requestSort('unit.name')}
                  className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                >
                  <div className="flex items-center justify-center">
                    Packing
                    <SortIndicator direction={sortConfig?.key === 'unit.name' ? sortConfig.direction : null} />
                  </div>
                </th>
              )}
              {!isHidden('vehicleNumber') && (
                <th
                  onClick={() => requestSort('vehicleNumber')}
                  className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                >
                  <div className="flex items-center justify-center">
                    Vehicle No.
                    <SortIndicator direction={sortConfig?.key === 'vehicleNumber' ? sortConfig.direction : null} />
                  </div>
                </th>
              )}
              {tableType === 'outward-return' && !isHidden('doNumber') && (
                <th
                  onClick={() => requestSort('doNumber')}
                  className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 text-center border-r ${theme.border.primary}`}
                >
                  <div className="flex items-center justify-center">
                    D.O. No.
                    <SortIndicator direction={sortConfig?.key === 'doNumber' ? sortConfig.direction : null} />
                  </div>
                </th>
              )}
              {!isHidden('warehouse') && (
                <th
                  onClick={() => requestSort('warehouse.name')}
                  className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                >
                  <div className="flex items-center justify-center">
                    Location
                    <SortIndicator direction={sortConfig?.key === 'warehouse.name' ? sortConfig.direction : null} />
                  </div>
                </th>
              )}
              {!isHidden('remark') && (
                <th
                  onClick={() => requestSort('remark')}
                  className={`px-3 py-2 text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide cursor-pointer hover:${theme.bg.hover} transition-colors duration-150 border-r ${theme.border.primary}`}
                >
                  <div className="flex items-center justify-center">
                    Remarks
                    <SortIndicator direction={sortConfig?.key === 'remark' ? sortConfig.direction : null} />
                  </div>
                </th>
              )}
              {!isHidden('actions') && (
                <th
                  className={`px-3 py-2 text-center text-[11px] font-medium ${theme.text.muted} uppercase tracking-wide whitespace-nowrap`}
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className={`divide-y ${theme.border.primary}`}>
            {entries.map((entry) => (
              <tr
                key={`${entry._id}`}
                className={`group hover:${theme.bg.hover} transition-all duration-150 ease-in-out cursor-pointer border-b ${theme.border.primary} last:border-0 text-xs`}
              >
                {!isHidden('enteredAt') && (
                  <td
                    data-label="Date & Time"
                    className={`px-3 py-2 text-xs ${theme.text.primary} whitespace-nowrap border-r ${theme.border.primary}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{new Date(entry.enteredAt).toLocaleDateString("en-GB", {
                        timeZone: 'UTC',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',

                      })}</span>
                      <span className={`text-xs ${theme.text.muted} group-hover:${theme.text.secondary} transition-colors`}>{new Date(entry.enteredAt).toLocaleTimeString("en-GB", { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}</span>
                    </div>
                  </td>
                )}
                {!isHidden('type') && (
                  <td data-label="Type" className={`px-3 py-2 whitespace-nowrap border-r ${theme.border.primary}`}>
                    <span className="inline-flex items-center">
                      <TransactionTypeBadge type={entry.type} />
                    </span>
                  </td>
                )}
                {!isHidden('party') && (
                  <td
                    data-label="Party"
                    className={`px-3 py-2 text-xs ${theme.text.primary} whitespace-nowrap text-center font-medium border-r ${theme.border.primary}`}
                    title={entry.party.name}
                  >
                    <div className="truncate max-w-[180px]">{entry.party.name}</div>
                  </td>
                )}
                {!isHidden('item') && (
                  <td
                    data-label="Item Name"
                    className={`px-3 py-2 whitespace-nowrap text-xs font-semibold ${theme.text.primary} group-hover:text-accent-600 transition-colors duration-150 border-r ${theme.border.primary}`}
                    title={entry.item.name}
                  >
                    <div className="truncate max-w-[200px] text-center">{entry.item.name}</div>
                  </td>
                )}
                {!isHidden('lotNumber') && (
                  <td data-label="Lot Number" className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.secondary} text-center border-r ${theme.border.primary}`}>
                    {getDisplayLotNumber(entry.lotNumber)}
                  </td>
                )}
                {!isHidden('quantity') && (
                  <td
                    data-label="Quantity"
                    className={`px-1 py-2 text-xs ${theme.text.primary} whitespace-nowrap text-center font-medium border-r ${theme.border.primary}`}
                  >
                    <div className={`inline-flex items-center justify-center min-w-[60px] px-2.5 py-1 rounded-md ${theme.bg.secondary} group-hover:${theme.bg.tertiary} transition-colors duration-150`}>
                      <span className={theme.text.primary}>{entry.quantity}</span>

                    </div>
                  </td>
                )}
                {
                  tableType === 'inward' && (
                    <td data-label="Shortage" className={`px-1 py-2 whitespace-nowrap text-xs ${theme.text.secondary} border-r ${theme.border.primary}`}>
                      <div className="flex flex-col space-y-1 justify-center text-center">
                        {entry.shortage === 0 && entry.extra === 0 ? (
                          <span className="text-gray-500">-</span>
                        ) : null}
                        {entry.shortage > 0 ? (
                          <span className="text-orange-600">{entry.shortage}</span>
                        ) : null}
                        {entry.extra > 0 ? (
                          <span className="text-green-600">{entry.extra}</span>
                        ) : null}
                      </div>

                    </td>
                  )
                }
                {!isHidden('unit') && (
                  <td data-label="Packing" className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.secondary} border-r ${theme.border.primary} text-center`}>{entry.unit.name}</td>
                )}
                {!isHidden('vehicleNumber') && (
                  <td data-label="Vehicle No." className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.secondary} border-r ${theme.border.primary} text-center`}>{entry.vehicleNumber}</td>
                )}
                {tableType === 'outward-return' && !isHidden('doNumber') && (
                  <td data-label="D.O. No." className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.secondary} border-r ${theme.border.primary} text-center`}>{entry.doNumber || ''}</td>
                )}
                {!isHidden('warehouse') && (
                  <td data-label="Location" className={`px-3 py-2 whitespace-nowrap ${theme.text.secondary} border-r ${theme.border.primary} text-center`}>
                    {entry.warehouses.map(warehouse => warehouse.name).join(', ')}
                  </td>
                )}
                {!isHidden('remark') && (
                  <td data-label="Remarks" className={`px-3 py-2 whitespace-nowrap text-xs ${theme.text.secondary} truncate max-w-[120px] border-r ${theme.border.primary} text-center`} title={entry.remark}>{entry.remark || ''}</td>
                )}
                {!isHidden('actions') && (
                  <td data-label="Actions" className="px-3 py-2 whitespace-nowrap text-center space-x-1">
                    {tableType === 'outward-return' && (
                      <Button size="sm" variant='secondary' onClick={() => onDownload(entry.batchId)} aria-label={`Download Gate Pass for transaction ${entry._id}`}>
                        <DoorOpen size="15" />
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => onEdit(entry._id)} aria-label={`Edit transaction ${entry._id}`}>
                      <EditIcon />
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => onDelete(entry._id)} aria-label={`Delete transaction ${entry._id}`}>
                      <TableDeleteIcon />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionTable;