
import React, { useEffect, useMemo, useState } from 'react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import PageHeader from '../components/common/PageHeader';
import { SortableTh, TableFilter } from '../components/common/Table';
import { useAppContext } from '../contexts/AppContext';
import { useNotify } from '../hooks/useNotify';
import { useSortableData } from '../hooks/useSortableData';
import { useTheme } from '../hooks/useTheme';
import { GalaLocation, Item, PackagingUnit } from '../types';
import Pagination from '../components/common/Pagination';

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

const ItemsPage: React.FC = () => {
  const notify = useNotify();
  const { theme } = useTheme();
  const {
    items, addItem, updateItem, deleteItem,
    packagingUnits, addPackagingUnit, updatePackagingUnit, deletePackagingUnit,
    galaLocations, addGalaLocation, updateGalaLocation, deleteGalaLocation
  } = useAppContext();

  // Item state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<Item | null>(null);
  const [itemFormData, setItemFormData] = useState<Omit<Item, '_id'>>({
    name: '',
    category: '',
    description: ''
  });
  const { items: sortedItems, requestSort: requestItemSort, sortConfig: itemSortConfig, filterQuery: itemFilterQuery, setFilterQuery: setItemFilterQuery, pagination: itemsPagination } = useSortableData(
    items, { key: 'name', direction: 'asc' }, ['name', 'category'], {paginate: true}
  );

  // Packaging Unit state
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [unitToEdit, setUnitToEdit] = useState<PackagingUnit | null>(null);
  const [unitFormData, setUnitFormData] = useState<Omit<PackagingUnit, '_id'>>({
    name: '',
    rate: 0,
  });
  const { items: sortedUnits, requestSort: requestUnitSort, sortConfig: unitSortConfig, filterQuery: unitFilterQuery, setFilterQuery: setUnitFilterQuery, pagination: unitsPagination } = useSortableData(
    packagingUnits, { key: 'name', direction: 'asc' }, ['name', 'rate'], {paginate: true}
  );

  // Gala Location state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationToEdit, setLocationToEdit] = useState<GalaLocation | null>(null);
  const [locationFormData, setLocationFormData] = useState<Omit<GalaLocation, '_id'>>({
    name: '',
  });
  const { items: sortedLocations, requestSort: requestLocationSort, sortConfig: locationSortConfig, filterQuery: locationFilterQuery, setFilterQuery: setLocationFilterQuery, pagination: locationsPagination } = useSortableData(
    galaLocations, { key: 'name', direction: 'asc' }, ['name'], {paginate: true}
  );

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'item' | 'unit' | 'location', id: string, name: string } | null>(null);

  useEffect(() => {
    if (itemToEdit) setItemFormData({ name: itemToEdit.name, category: itemToEdit.category, description: itemToEdit.description });
    else setItemFormData({ name: '', category: '', description: '' });
  }, [itemToEdit]);

  useEffect(() => {
    if (unitToEdit) setUnitFormData({ name: unitToEdit.name, rate: unitToEdit.rate });
    else setUnitFormData({ name: '', rate: 0 });
  }, [unitToEdit]);

  useEffect(() => {
    if (locationToEdit) setLocationFormData({ name: locationToEdit.name });
    else setLocationFormData({ name: '' });
  }, [locationToEdit]);

  const openItemModal = (item: Item | null = null) => { setItemToEdit(item); setIsItemModalOpen(true); };
  const openUnitModal = (unit: PackagingUnit | null = null) => { setUnitToEdit(unit); setIsUnitModalOpen(true); };
  const openLocationModal = (location: GalaLocation | null = null) => { setLocationToEdit(location); setIsLocationModalOpen(true); };

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (itemToEdit) {
      try {
        updateItem(itemToEdit._id, { ...itemToEdit, ...itemFormData });
      } catch (error) {
        notify({ type: 'error', message: 'Failed to update item.' });
      }
    } else {
      try {
        addItem(itemFormData);
      } catch (error) {
        notify({ type: 'error', message: 'Failed to add item.' });
      }
    }
    setIsItemModalOpen(false);
    setItemToEdit(null);
    setItemFormData({ name: '', category: '', description: '' });
  };

  const handleItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setItemFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUnitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unitToEdit) {
      try {
        updatePackagingUnit(unitToEdit._id, { ...unitToEdit, ...unitFormData });
      } catch (error) {
        notify({ type: 'error', message: 'Failed to update packaging unit.' });
      }
    } else {
      try {
        addPackagingUnit(unitFormData);
      } catch (error) {
        notify({ type: 'error', message: 'Failed to add packaging unit.' });
      }
    }
    setUnitToEdit(null);
    setUnitFormData({ name: '', rate: 0 });
    setIsUnitModalOpen(false);
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUnitFormData(prev => ({
      ...prev,
      [name]: name === 'rate' ? (value === '' ? '' : parseFloat(value) || 0) : value
    }));
  };

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (locationToEdit) {
      try {
        updateGalaLocation(locationToEdit._id, locationFormData);
      } catch (error) {
        notify({ type: 'error', message: 'Failed to update location.' });
      }
    } else {
      try {
        addGalaLocation(locationFormData);
      } catch (error) {
        notify({ type: 'error', message: 'Failed to add location.' });
      }
    }
    setIsLocationModalOpen(false);
    setLocationToEdit(null);
    setLocationFormData({ name: '' });
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocationFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    try {
      switch (deleteTarget.type) {
        case 'item': deleteItem(deleteTarget.id); break;
        case 'unit': deletePackagingUnit(deleteTarget.id); break;
        case 'location': deleteGalaLocation(deleteTarget.id); break;
      }
      setDeleteTarget(null);
    } catch (error) {
      notify({ type: 'error', message: `Failed to delete ${deleteTarget.type}.` });
    }
  };

  const categories = useMemo(() => [...new Set(items.map(i => i.category).filter(Boolean as any))], [items]);

  return (
    <div className='min-h-screen max-h-screen'>
      <PageHeader title="Master Data Management" />

      {/* Items Section */}
      <section className="mb-12">
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-xl font-semibold ${theme.text.primary}`}>Items</h2>
          <Button onClick={() => openItemModal()}>Add New Item</Button>
        </div>
        <div className="mb-4">
          <TableFilter filterQuery={itemFilterQuery} setFilterQuery={setItemFilterQuery} placeholder="Filter by item name or category..." />
        </div>
        <div className={`${theme.bg.card} border ${theme.border.primary} rounded-xl shadow-sm responsive-table-wrapper`}>
          <table className={`min-w-full divide-y ${theme.border.primary} responsive-table`}>
            <thead className={theme.bg.secondary}>
              <tr>
                <SortableTh sortKey="name" sortConfig={itemSortConfig} requestSort={requestItemSort}>Item Name</SortableTh>
                <SortableTh sortKey="category" sortConfig={itemSortConfig} requestSort={requestItemSort}>Category</SortableTh>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme.border.primary} `}>
              {sortedItems.map((item) => (
                <tr key={item._id} className={`border-b ${theme.border.primary}`}>
                  <td data-label="Item Name" className={`px-4 py-2 whitespace-nowrap text-sm font-medium ${theme.text.primary}`}>{item.name}</td>
                  <td data-label="Category" className={`px-4 py-2 whitespace-nowrap text-sm ${theme.text.secondary}`}>{item.category || 'Uncategorized'}</td>
                  <td data-label="Actions" className="px-4 py-2 whitespace-nowrap text-sm text-right space-x-2">
                    <Button size="sm" variant="secondary" onClick={() => openItemModal(item)} aria-label={`Edit ${item.name}`}><EditIcon /></Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleteTarget({ type: 'item', id: item._id, name: item.name })} aria-label={`Delete ${item.name}`}><DeleteIcon /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          
          </table>
          <Pagination
              currentPage={itemsPagination.currentPage}
              totalPages={itemsPagination.totalPages}
              onPageChange={itemsPagination.setCurrentPage}
              totalItems={itemsPagination.totalItems}
              itemsPerPage={itemsPagination.itemsPerPage}
            />
        </div>
      </section>

      {/* Packaging Units Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-xl font-semibold ${theme.text.primary}`}>Packaging Units</h2>
          <Button onClick={() => openUnitModal()}>Add New Unit</Button>
        </div>
        <div className="mb-4">
          <TableFilter filterQuery={unitFilterQuery} setFilterQuery={setUnitFilterQuery} placeholder="Filter by unit name..." />
        </div>
        <div className={`${theme.bg.card} border ${theme.border.primary} rounded-xl shadow-sm responsive-table-wrapper`}>
          <table className={`min-w-full divide-y ${theme.border.primary} responsive-table`}>
            <thead className={theme.bg.secondary}>
              <tr>
                <SortableTh sortKey="name" sortConfig={unitSortConfig} requestSort={requestUnitSort}>Unit Name</SortableTh>
                <SortableTh sortKey="rate" sortConfig={unitSortConfig} requestSort={requestUnitSort}>Charge Rate (₹/Unit/Mo)</SortableTh>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme.border.primary}`}>
              {sortedUnits.map((unit) => (
                <tr key={unit._id} className={`border-b ${theme.border.primary}`}>
                  <td data-label="Unit Name" className={`px-4 py-2 whitespace-nowrap text-sm font-medium ${theme.text.primary}`}>{unit.name}</td>
                  <td data-label="Charge Rate (₹/Unit/Mo)" className={`px-4 py-2 whitespace-nowrap text-sm ${theme.text.secondary}`}>{unit.rate?.toFixed(2)}</td>
                  <td data-label="Actions" className="px-4 py-2 whitespace-nowrap text-sm text-right space-x-2">
                    <Button size="sm" variant="secondary" onClick={() => openUnitModal(unit)} aria-label={`Edit ${unit.name}`}><EditIcon /></Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleteTarget({ type: 'unit', id: unit._id, name: unit.name })} aria-label={`Delete ${unit.name}`}><DeleteIcon /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
              currentPage={unitsPagination.currentPage}
              totalPages={unitsPagination.totalPages}
              onPageChange={unitsPagination.setCurrentPage}
              totalItems={unitsPagination.totalItems}
              itemsPerPage={unitsPagination.itemsPerPage}
            />
        </div>
      </section>

      {/* Gala Locations Section */}
      <section className="pt-10 pb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-xl font-semibold ${theme.text.primary}`}>Gala/Warehouse Locations</h2>
          <Button onClick={() => openLocationModal()}>Add New Location</Button>
        </div>
        <div className="mb-4">
          <TableFilter filterQuery={locationFilterQuery} setFilterQuery={setLocationFilterQuery} placeholder="Filter by location name..." />
        </div>
        <div className={`${theme.bg.card} border ${theme.border.primary} rounded-xl shadow-sm responsive-table-wrapper`}>
          <table className={`min-w-full divide-y ${theme.border.primary} responsive-table`}>
            <thead className={theme.bg.secondary}>
              <tr>
                <SortableTh sortKey="name" sortConfig={locationSortConfig} requestSort={requestLocationSort}>Location Name</SortableTh>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme.border.primary}`}>
              {sortedLocations.map((location) => (
                <tr key={location._id} className={`border-b ${theme.border.primary}`}>
                  <td data-label="Location Name" className={`px-4 py-2 whitespace-nowrap text-sm font-medium ${theme.text.primary}`}>{location.name}</td>
                  <td data-label="Actions" className="px-4 py-2 whitespace-nowrap text-sm text-right space-x-2">
                    <Button size="sm" variant="secondary" onClick={() => openLocationModal(location)} aria-label={`Edit ${location.name}`}><EditIcon /></Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleteTarget({ type: 'location', id: location._id, name: location.name })} aria-label={`Delete ${location.name}`}><DeleteIcon /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
              currentPage={locationsPagination.currentPage}
              totalPages={locationsPagination.totalPages}
              onPageChange={locationsPagination.setCurrentPage}
              totalItems={locationsPagination.totalItems}
              itemsPerPage={locationsPagination.itemsPerPage}
            />
        </div>
      </section>

      {/* Item Modal */}
      <Modal isOpen={isItemModalOpen} onClose={() => setIsItemModalOpen(false)} title={itemToEdit ? "Edit Item" : "Add New Item"} footer={<><Button variant="secondary" onClick={() => setIsItemModalOpen(false)}>Cancel</Button><Button type="submit" form="item-form">Save</Button></>}>
        <form id="item-form" onSubmit={handleItemSubmit} className="space-y-4">
          <Input
            name="name"
            label="Item Name"
            value={itemFormData.name || ''}
            onChange={handleItemChange}
            required
          />
          <Input
            name="category"
            label="Category"
            value={itemFormData.category || ''}
            onChange={handleItemChange}
            list="category-suggestions"
            autoComplete="off"
          />
          <datalist id="category-suggestions">{categories.map(cat => <option key={cat} value={cat} />)}</datalist>
        </form>
      </Modal>

      {/* Packaging Unit Modal */}
      <Modal isOpen={isUnitModalOpen} onClose={() => setIsUnitModalOpen(false)} title={unitToEdit ? "Edit Packaging Unit" : "Add New Packaging Unit"} footer={<><Button variant="secondary" onClick={() => setIsUnitModalOpen(false)}>Cancel</Button><Button type="submit" form="unit-form">Save</Button></>}>
        <form id="unit-form" onSubmit={handleUnitSubmit} className="space-y-4">
          <Input
            name="name"
            label="Unit Name"
            value={unitFormData.name || ''}
            onChange={handleUnitChange}
            required
          />
          <Input
            name="rate"
            label="Charge Rate"
            type="number"
            min="0"
            step="0.01"
            value={unitFormData.rate ?? ''}
            onChange={handleUnitChange}
            required
          />
        </form>
      </Modal>

      {/* Gala Location Modal */}
      <Modal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} title={locationToEdit ? "Edit Location" : "Add New Location"} footer={<><Button variant="secondary" onClick={() => setIsLocationModalOpen(false)}>Cancel</Button><Button type="submit" form="location-form">Save</Button></>}>
        <form id="location-form" onSubmit={handleLocationSubmit} className="space-y-4">
          <Input
            name="name"
            label="Location Name"
            value={locationFormData.name || ''}
            onChange={handleLocationChange}
            required
          />
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Deletion" footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" onClick={confirmDelete}>Delete</Button></>}>
        <p className={theme.text.primary}>Are you sure you want to delete <strong className={`font-semibold ${theme.text.primary}`}>"{deleteTarget?.name}"</strong>? This action cannot be undone.</p>
        {deleteTarget &&
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">Warning: Deleting master data might affect historical records and cause inconsistencies if it's already in use.</p>
        }
      </Modal>
    </div>
  );
};

export default ItemsPage;
