import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useTheme } from '../../hooks/useTheme';
import { GalaLocation, Item, PackagingUnit, Party, StockTransaction, StockTransactionForm, StockTransactionType } from '../../types';
import { stockBalanceApi } from '../../utils/api';
import { constructLotNumber, generateAbbreviation, getFinancialYearString } from '../../utils/lotNumber';
import Autocomplete from '../common/Autocomplete';
import Button from '../common/Button';
import { AddIcon, DeleteIcon } from '../common/Icons';
import Input, { Select, Textarea } from '../common/Input';
import Modal from '../common/Modal';
import MultiSelectDropdown from '../common/MultiSelectDropdown';

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transaction: any, isEditing: boolean) => void;
  transactionToEdit: StockTransaction | null;
  parties: Party[];
  items: Item[];
  packagingUnits: PackagingUnit[];
  galaLocations: GalaLocation[];
}

const TransactionForm: React.FC<TransactionFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  transactionToEdit,
  parties,
  items,
  packagingUnits,
  galaLocations,
}) => {
  const { theme } = useTheme();
  const { addItem, updateItem, getLotNumbers, getDoNumbers } = useAppContext();
  // Track available lot numbers for each item
  const [availableLotNumbers, setAvailableLotNumbers] = useState<Record<string, string[]>>({});
  const [availableDONumbers, setAvailableDONumbers] = useState<string[]>([]);
  const [availableQuantities, setAvailableQuantities] = useState<Record<number, number | undefined>>({});

  const initialItemState = useMemo(() => ({
    itemId: '',
    lotNumber: '',
    warehouses: [],
    unitId: '',
    quantity: 0,
    extra: 0,
    shortage: 0,
    vehicleNumber: '',
    remark: '',
    category: ''
  }), [packagingUnits, galaLocations]);

  const initialFormState = useMemo(() => ({
    type: StockTransactionType.INWARD,
    partyId: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
    charge: true,
    doNumber: '',
    batchId: crypto.randomUUID(),
    items: [initialItemState],
  }), [initialItemState]);

  const [newTransaction, setNewTransaction] = useState<StockTransactionForm>(initialFormState);
  const [itemNames, setItemNames] = useState<string[]>(['']);
  const [itemCategories, setItemCategories] = useState<string[]>(['']);
  useEffect(() => {
    if (isOpen) {
      if (transactionToEdit) {
        const lotNumberParts = transactionToEdit.lotNumber.split('|');
        const userInputLotNumber = lotNumberParts.pop() || '';
        setNewTransaction({
          type: transactionToEdit.type,
          partyId: transactionToEdit.party._id,
          date: transactionToEdit.enteredAt.split('T')[0],
          time: transactionToEdit.enteredAt.split('T')[1].substring(0, 5),
          doNumber: transactionToEdit.doNumber,
          batchId: transactionToEdit.batchId,
          charge: transactionToEdit.charge,
          items: [{
            itemId: transactionToEdit.item._id,
            lotNumber: userInputLotNumber,
            quantity: transactionToEdit.quantity + (transactionToEdit.shortage || 0) - (transactionToEdit.extra || 0),
            shortage: transactionToEdit.shortage,
            unitId: transactionToEdit.unit._id,
            warehouses: transactionToEdit.warehouses.map(warehouse => warehouse._id),
            vehicleNumber: transactionToEdit.vehicleNumber,
            remark: transactionToEdit.remark,
            category: transactionToEdit.item.category,
            extra: transactionToEdit.extra
          }]
        });
        setItemNames([transactionToEdit.item.name]);
        setItemCategories([transactionToEdit.item.category]);
      } else {
        setNewTransaction(initialFormState);
        //generate new batch id every time 
        setNewTransaction(prev => ({ ...prev, batchId: crypto.randomUUID() }));
        setItemNames(['']);
        setItemCategories(['']);
      }
    }
  }, [isOpen, transactionToEdit, initialFormState, items]);

  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "charge") {
      setNewTransaction(prev => ({ ...prev, [name]: value === "true" }));
    } else {
      setNewTransaction(prev => ({ ...prev, [name]: value }));
    }
    // When party changes, update lot numbers for all items
    if (name === 'partyId') {
      const party = parties.find(p => p._id === value);
      if (party) {
        const updatedItems = newTransaction.items.map((item) => {
          const userInput = (item.lotNumber || '').split('|').pop() || '';
          return {
            ...item,
            lotNumber: userInput // Only store the user input part
          };
        });
        setNewTransaction(prev => ({ ...prev, items: updatedItems }));
      }
    }

  };

  const handleItemChange = (index: number, field: keyof StockTransactionForm['items'][number], value: string | number | string[]) => {
    setNewTransaction(prev => {
      const updatedItems = [...prev.items];
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value
      };
      return { ...prev, items: updatedItems };
    });
  };



  // Update available lot numbers when item or party changes
  useEffect(() => {
    const newAvailableLotNumbers: Record<string, string[]> = {};

    itemNames.forEach((itemName, index) => {
      const partyName = parties.find(p => p._id === newTransaction.partyId)?.name;
      if (!partyName) return;
      const year = getFinancialYearString(newTransaction.date);
      const partyAbbr = generateAbbreviation(partyName, 3);
      const itemAbbr = generateAbbreviation(itemName, 4, true);
      const searchLotNumber = `${partyAbbr}|${year}|${itemAbbr}`;
      getLotNumbers(searchLotNumber).then(lotNumbers => {
        newAvailableLotNumbers[index] = lotNumbers;
      });
    });

    setAvailableLotNumbers(newAvailableLotNumbers);
  }, [itemNames, newTransaction.partyId, getLotNumbers]);

  useEffect(() => {
    if (newTransaction.type === StockTransactionType.OUTWARD || newTransaction.type === StockTransactionType.RETURN) {
      getDoNumbers().then(doNumbers => {
        setAvailableDONumbers(doNumbers);
      });
    }
  }, [newTransaction.type, getDoNumbers]);

  const handleLotNumberChange = async (index: number, value: string) => {

    // Determine user input (last segment) and full lot number to search
    const userInput = value.split('|').pop() || '';

    // Build full lot number. If value already looks like a full lot number (has >=4 segments), use it.
    let fullLotNumber = '';
    if (value.split('|').length >= 4) {
      fullLotNumber = value;
      const stock = await getStockDetails(fullLotNumber);
      if (!stock || !stock.warehouses || stock.warehouses.length === 0 || !stock.unit || !stock.unit._id) {
        setAvailableQuantities(prev => ({ ...prev, [index]: undefined }));
        handleItemChange(index, 'unitId', '');
        handleItemChange(index, 'warehouses', []);
        return;
      }
      const warehouseIds = stock.warehouses.map((w: any) => w._id || w);
      handleItemChange(index, 'unitId', stock.unit._id);
      handleItemChange(index, 'warehouses', warehouseIds);
      if (typeof stock.quantity !== 'undefined') {
        setAvailableQuantities(prev => ({ ...prev, [index]: stock.quantity }));
      }
    } else {
      if (!userInput) {
        setAvailableQuantities(prev => ({ ...prev, [index]: undefined }));
        handleItemChange(index, 'unitId', '');
        handleItemChange(index, 'warehouses', []);
        handleItemChange(index, 'lotNumber', '');
        return;
      }
    }
    handleItemChange(index, 'lotNumber', userInput);

  };


  // Helper to fetch stock details by lot number
  const getStockDetails = async (lotNumber: string) => {
    try {
      const res = await stockBalanceApi.getAll({ search: lotNumber });
      const data = (res && (res.data || res)) as any;
      const stocks = Array.isArray(data) ? data : (data?.stocks || []);
      return stocks && stocks.length > 0 ? stocks[0] : null;
    } catch (err) {
      console.error('Error fetching stock details for lot number', lotNumber, err);
      return null;
    }
  };

  const handleItemNameChange = (index: number, name: string) => {
    const newItemNames = [...itemNames];
    newItemNames[index] = name;
    setItemNames(newItemNames);

    const existingItem = items.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (existingItem) {
      handleItemChange(index, 'itemId', existingItem._id);
      // Update category when selecting existing item
      const newCategories = [...itemCategories];
      newCategories[index] = existingItem.category || '';
      setItemCategories(newCategories);

      // Update available lot numbers for this item
      if (newTransaction.partyId) {
        const partyName = parties.find(p => p._id === newTransaction.partyId)?.name;
        const partyAbbr = generateAbbreviation(partyName || '', 3);
        const year = getFinancialYearString(newTransaction.date);

        const itemAbbr = generateAbbreviation(name, 4, true);
        const searchLotNumber = `${partyAbbr}|${year}|${itemAbbr}`;
        getLotNumbers(searchLotNumber).then(lotNumbers => {
          setAvailableLotNumbers({
            ...availableLotNumbers,
            [index]: lotNumbers
          });
        });
      }
    } else {
      // Clear item ID for new items - will be handled in form submission
      handleItemChange(index, 'itemId', '');
      setAvailableLotNumbers(prev => ({
        ...prev,
        [index]: []
      }));
    }
    // Clear fetched quantity when item changes
    setAvailableQuantities(prev => ({ ...prev, [index]: undefined }));
  };

  const handleCategoryChange = (index: number, category: string) => {
    const newCategories = [...itemCategories];
    newCategories[index] = category;
    setItemCategories(newCategories);
  };

  const addItemRow = () => {
    setNewTransaction(prev => ({ ...prev, items: [...prev.items, initialItemState] }));
    setItemNames(prev => [...prev, '']);
    setItemCategories(prev => [...prev, '']);
  };

  const removeItemRow = (index: number) => {
    if (newTransaction.items.length <= 1) return;
    setNewTransaction(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    setItemNames(prev => prev.filter((_, i) => i !== index));
    setItemCategories(prev => prev.filter((_, i) => i !== index));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const party = newTransaction.partyId;
    const partyName = parties.find(p => p._id === party)?.name;
    if (!party) {
      alert('Please select a valid party.');
      return;
    }

    const processedItems = newTransaction.items.map((item, index) => {
      let currentItem = { ...item };
      const itemName = itemNames[index].trim();
      let itemInfo = items.find(i => i._id === currentItem.itemId);

      if (!itemInfo && itemName) {
        const existingItem = items.find(i => i.name.toLowerCase() === itemName.toLowerCase());
        if (existingItem) {
          itemInfo = existingItem;
          currentItem.itemId = existingItem._id;
        } else {
          const category = itemCategories[index] || '';
          const itemData: Omit<Item, '_id'> = {
            name: itemName,
            category,
            description: ''
          };
          addItem(itemData).then(item => {
            itemInfo = item
            currentItem.itemId = item._id;
          });
        }
      } else if (itemInfo && itemCategories[index]) {
        // Update existing item's category if changed
        const category = itemCategories[index];
        if (category && itemInfo.category !== category) {
          updateItem(itemInfo._id, { ...itemInfo, category }).then(item => {
            itemInfo = item
            currentItem.itemId = item._id;
          });
        }
      }

      if (currentItem.itemId && currentItem.quantity > 0 && itemInfo) {
        currentItem.lotNumber = constructLotNumber(
          partyName || '',
          itemInfo.name,
          newTransaction.date,
          currentItem.lotNumber // This is user input
        );
        return currentItem;
      }
      return null;
    }).filter((i): i is StockTransactionForm['items'][number] => i !== null);


    if (!party || processedItems.length === 0) {
      alert('Please ensure Party is selected and at least one valid item with quantity is added.');
      return;
    }

    const transactionData = { ...newTransaction, items: processedItems };
    // Pass the entire transaction data to handle bulk or single submission in parent
    onSubmit(transactionData as any, !!transactionToEdit);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={transactionToEdit ? "Edit Stock Transaction" : "Add New Stock Transaction"} size="xl" footer={<><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="add-stock-entry-form">{transactionToEdit ? "Save Changes" : "Add Transaction"}</Button></>}>
      <form id="add-stock-entry-form" onSubmit={handleFormSubmit} className="space-y-6">
        {/* Transaction Header */}
        <div className="p-4 border border-slate-200 rounded-lg">
          <h3 className={`text-lg font-medium leading-6 ${theme.text.primary} mb-4`}>Transaction Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
            <Select label="Transaction Type" name="type" value={newTransaction.type} onChange={handleHeaderChange} required>
              {Object.values(StockTransactionType).map(type => (<option key={type} value={type}>{type}</option>))}
            </Select>
            <Select label="Party" name="partyId" value={newTransaction.partyId} onChange={handleHeaderChange} required>
              <option value="">Select Party</option>
              {parties.map(party => <option key={party._id} value={party._id}>{party.name}</option>)}
            </Select>
            {(newTransaction.type === StockTransactionType.OUTWARD || newTransaction.type === StockTransactionType.RETURN) && (
              <>
                <Input label="D.O. Number" name="doNumber" value={newTransaction.doNumber || ''} onChange={handleHeaderChange} list="do-number-suggestions" autoComplete="off" placeholder="Select or enter D.O. number" />
                <datalist id="do-number-suggestions">
                  {availableDONumbers.map((doNumber, i) => (
                    <option key={i} value={doNumber} />
                  ))}
                </datalist>
              </>
            )}
            <Input label="Date" name="date" type="date" value={newTransaction.date} onChange={handleHeaderChange} required />
            <Input label="Time" name="time" type="time" value={newTransaction.time} onChange={handleHeaderChange} required />
            <div className="flex flex-col gap-3">
              <label className={`block text-sm font-medium leading-6 ${theme.text.secondary}`}>Store</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="notCharge"
                    value="yes"
                    checked={newTransaction.charge}
                    onChange={e => handleHeaderChange({ ...e, target: { ...e.target, name: "charge", value: "true" } })}
                    className="mr-2"
                  />
                  Yes
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="notCharge"
                    value="no"
                    checked={!newTransaction.charge}
                    onChange={e => handleHeaderChange({ ...e, target: { ...e.target, name: "charge", value: "false" } })}
                    className="mr-2"
                  />
                  No
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="space-y-4">
          <h3 className={`text-lg font-medium leading-6 ${theme.text.primary}`}>Items</h3>
          {newTransaction.items.map((item, index) => (
            <div key={index} className={`p-4 border ${theme.border.primary} rounded-lg relative`}>
              {newTransaction.items.length > 1 && !transactionToEdit && (
                <button type="button" onClick={() => removeItemRow(index)} className="absolute top-2 right-2" aria-label="Remove item">
                  <DeleteIcon />
                </button>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-4">
                <div className="lg:col-span-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Autocomplete
                        label="Item"
                        options={items.map(item => item.name)}
                        value={itemNames[index]}
                        onChange={(value) => handleItemNameChange(index, value)}
                        onCreate={(value) => handleItemNameChange(index, value)}
                        placeholder="Select or create an item"
                        required
                      />
                    </div>
                    <div>
                      <Autocomplete
                        label="Category"
                        options={Array.from(new Set(items.map(item => item.category).filter(Boolean)))}
                        value={itemCategories[index] || ''}
                        onChange={(value) => handleCategoryChange(index, value)}
                        onCreate={(value) => handleCategoryChange(index, value)}
                        placeholder="Select or create a category"
                      />
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-2 mt-1">
                  <div className="relative w-full">
                    <label className={`block ${theme.text.secondary} mb-0 text-sm`}>Lot Number</label>
                    <div className="flex items-center gap-1">
                      <div className={`w-10 h-10 border ${theme.border.primary} rounded-md text-sm text-center flex items-center justify-center`} contentEditable={false}>
                        {generateAbbreviation(parties.find(p => p._id === newTransaction.partyId)?.name || '', 3) || ''}
                      </div>
                      <div className={`w-12 h-10 border ${theme.border.primary} rounded-md text-sm text-center flex items-center justify-center`} contentEditable={true} suppressContentEditableWarning={true}>
                        {getFinancialYearString(newTransaction.date) || ''}
                      </div>
                      <div className={`w-12 h-10 border ${theme.border.primary} rounded-md text-sm text-center py-2 flex items-center justify-center`} contentEditable={false}>
                        {generateAbbreviation(itemNames[index], 4, true).replace(/-/g, '').slice(0, 3) || ''}
                      </div>
                      <div className="flex-1 mb-2">
                        <Input
                          type="text"
                          value={item.lotNumber}
                          onChange={(e) => handleLotNumberChange(index, e.target.value)}
                          list={`lot-numbers-${index}`}
                          placeholder="Enter lot no."
                          className="w-full h-10.5"
                        />
                        <datalist id={`lot-numbers-${index}`}>
                          {availableLotNumbers[index]?.map((lotNumber, i) => (
                            <option key={i} value={lotNumber} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <Input label="Vehicle Number" value={item.vehicleNumber} onChange={(e) => handleItemChange(index, 'vehicleNumber', e.target.value)} required />
                </div>

                <Input
                  label={availableQuantities[index] !== undefined ? `Quantity (${availableQuantities[index]})` : 'Quantity'}
                  type="text"
                  value={item.quantity.toString()}
                  onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                  pattern="[0-9]*"
                  required
                />
                {/* Display available quantity if fetched for this lot */}
                <Select label="Packing Type" value={item.unitId} onChange={(e) => handleItemChange(index, 'unitId', e.target.value)} required>
                  <option value="">Select Packing</option>
                  {packagingUnits.map(unit => <option key={unit._id} value={unit._id}>{unit.name}</option>)}
                </Select>
                {newTransaction.type === StockTransactionType.INWARD || newTransaction.type === StockTransactionType.RETURN ? (
                  <>
                    <Input label="Shortage (if any)" type="text" value={String(item.shortage || 0)} onChange={(e) =>
                      handleItemChange(index, 'shortage', parseFloat(e.target.value) || 0)} pattern="[0-9]*" />
                    <Input label="Extra (if any)" type="text" value={String(item.extra || 0)} onChange={(e) => handleItemChange(index, 'extra', parseFloat(e.target.value) || 0)} pattern="[0-9]*"
                    /></>
                ) : null}
                {/* Multi-select dropdown for Locations */}
                <div className="space-y-2 relative lg:col-span-4" style={{ zIndex: 10 }}>
                  <label className={`block text-sm font-medium ${theme.text.secondary} mb-1`}>Locations</label>
                  <MultiSelectDropdown
                    options={galaLocations}
                    selected={(item.warehouses || [])}
                    onChange={selected => handleItemChange(index, 'warehouses', selected)}
                    placeholder="Select locations"
                  />
                </div>


                <div className="lg:col-span-4">
                  <Textarea label="Remarks" value={item.remark || ''} onChange={(e) => handleItemChange(index, 'remark', e.target.value)} rows={1} placeholder="Item-specific remarks" />
                </div>
              </div>
            </div>
          ))}
          {!transactionToEdit && (
            <Button type="button" variant="secondary" size="sm" onClick={addItemRow}><AddIcon /> Add Another Item</Button>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default TransactionForm;