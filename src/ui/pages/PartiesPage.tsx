
import React, { useState } from 'react';
import Button from '../components/common/Button';
import Input, { Textarea } from '../components/common/Input';
import Modal from '../components/common/Modal';
import PageHeader from '../components/common/PageHeader';
import { SortableTh, TableFilter } from '../components/common/Table';
import { useAppContext } from '../contexts/AppContext';
import { useNotify } from '../hooks/useNotify';
import { useSortableData } from '../hooks/useSortableData';
import { useTheme } from '../hooks/useTheme';
import { Party } from '../types';
import Pagination from '../components/common/Pagination';
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1v3M4 7h16" /></svg>;

const PartiesPage: React.FC = () => {
  const notify = useNotify();
  const { theme } = useTheme();
  const { parties, addParty, updateParty, deleteParty } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [partyToEdit, setPartyToEdit] = useState<Party | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Party | null>(null);

  // Updated form state for separate emails
  const initialFormState = {
    name: '',
    contactNo: '',
    businessContactEmail: '',
    orgEmail: '',
    address: '',
    gstNo: '',
    panNo: '',
  };
  const [formState, setFormState] = useState(initialFormState);

  // Removed the separate useEffect since we're now handling form state in openModal

  const {
    items: sortedParties,
    requestSort,
    sortConfig,
    filterQuery,
    setFilterQuery,
    pagination: partiesPagination
  } = useSortableData(
    parties,
    { key: 'name', direction: 'asc' },
    ['name', 'contactNos', 'businessContactEmail', 'orgEmail', 'gstNo'], // Updated searchable keys
    {paginate: true}
  );

  const openModal = (party: Party | null = null) => {
    setPartyToEdit(party);
    setIsModalOpen(true);

    // Reset form state when opening modal
    if (party) {
      setFormState({
        name: party.name,
        contactNo: party.contactNos.join(', '),
        businessContactEmail: party.businessContactEmail || '',
        orgEmail: party.orgEmail || '',
        address: party.address,
        gstNo: party.gstNo,
        panNo: party.panNo,
      });
    } else {
      setFormState(initialFormState);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setPartyToEdit(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const partyData: Omit<Party, '_id'> = {
        name: formState.name,
        address: formState.address,
        gstNo: formState.gstNo,
        panNo: formState.panNo,
        contactNos: formState.contactNo.split(',').map(s => s.trim()).filter(Boolean),
        businessContactEmail: formState.businessContactEmail.trim(),
        orgEmail: formState.orgEmail.trim(),
      };

      if (partyToEdit) {
        await updateParty(partyToEdit._id, partyData);
      } else {
        await addParty(partyData);
      }
      closeModal();
    } catch (error) {
      console.error('Failed to save party:', error);
      notify({ type: 'error', message: 'Failed to save party' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      try {
        await deleteParty(deleteTarget._id);
        setDeleteTarget(null);
      } catch (error) {
        console.error('Failed to delete party:', error);
        notify({ type: 'error', message: 'Failed to delete party' });
      }
    }
  };

  return (
    <div>
      <PageHeader title="Manage Parties">
        <Button onClick={() => openModal()}>Add New Party</Button>
      </PageHeader>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={partyToEdit ? 'Edit Party' : 'Add New Party'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" form="add-party-form">{partyToEdit ? 'Save Changes' : 'Add Party'}</Button>
          </>
        }
      >
        {/* Updated Form */}
        <form id="add-party-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
          <div className="md:col-span-2">
            <Input label="Party Name" name="name" value={formState.name} onChange={handleInputChange} required />
          </div>
          <div className="md:col-span-2">
            <Input label="Contact Nos." name="contactNo" value={formState.contactNo} onChange={handleInputChange} placeholder="e.g., 9876543210, 9876543211" />
          </div>
          <Input label="Business Email" name="businessContactEmail" type="email" value={formState.businessContactEmail} onChange={handleInputChange} placeholder="e.g., contact@example.com" />
          <Input label="Organization Email" name="orgEmail" type="email" value={formState.orgEmail} onChange={handleInputChange} placeholder="e.g., accounts@example.com" />
          <div className="md:col-span-2">
            <Textarea label="Address" name="address" value={formState.address} onChange={handleInputChange} />
          </div>
          <Input label="GST No." name="gstNo" value={formState.gstNo} onChange={handleInputChange} />
          <Input label="PAN No." name="panNo" value={formState.panNo} onChange={handleInputChange} />
        </form>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Deletion" footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" onClick={handleDeleteConfirm}>Delete</Button></>}>
        <p className={theme.text.primary}>Are you sure you want to delete <strong className={`font-semibold ${theme.text.primary}`}>"{deleteTarget?.name}"</strong>? This action cannot be undone.</p>
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">Warning: Deleting this party might affect historical stock transaction records.</p>
      </Modal>

      {parties.length === 0 ? (
        <div className={`text-center py-12 px-6 ${theme.bg.card} rounded-xl border-2 border-dashed ${theme.border.primary}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className={`mx-auto h-12 w-12 ${theme.text.muted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className={`mt-4 text-lg font-medium ${theme.text.primary}`}>No parties found</h3>
          <p className={`mt-1 text-sm ${theme.text.secondary}`}>Get started by adding a new party.</p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <TableFilter filterQuery={filterQuery} setFilterQuery={setFilterQuery} placeholder="Filter parties by name, contact, email..." />
          </div>
          <div className={`${theme.bg.card} border ${theme.border.primary} rounded-xl shadow-sm responsive-table-wrapper`}>
            {/* Updated Table */}
            <table className={`min-w-full divide-y ${theme.border.primary} responsive-table`}>
              <thead className={theme.bg.secondary}>
                <tr>
                  <SortableTh sortKey="name" sortConfig={sortConfig} requestSort={requestSort}>Name</SortableTh>
                  <SortableTh sortKey="contactNos" sortConfig={sortConfig} requestSort={requestSort}>Contact Nos.</SortableTh>
                  <SortableTh sortKey="businessContactEmail" sortConfig={sortConfig} requestSort={requestSort}>Business Email</SortableTh>
                  <SortableTh sortKey="orgEmail" sortConfig={sortConfig} requestSort={requestSort}>Organization Email</SortableTh>
                  <SortableTh sortKey="gstNo" sortConfig={sortConfig} requestSort={requestSort}>GST No.</SortableTh>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme.border.primary}`}>
                {sortedParties.map((party, index) => (
                  <tr key={index} className={`hover:${theme.bg.hover} transition-colors border-b ${theme.border.primary}`}>
                    <td data-label="Name" className={`px-4 py-2 whitespace-nowrap text-sm font-medium ${theme.text.primary}`}>{party.name}</td>
                    <td data-label="Contact Nos." className={`px-4 py-2 whitespace-nowrap text-sm ${theme.text.secondary}`}>{party.contactNos?.join(', ')}</td>
                    <td data-label="Business Email" className={`px-4 py-2 whitespace-nowrap text-sm ${theme.text.secondary}`}>{party.businessContactEmail || <span className={theme.text.muted}>N/A</span>}</td>
                    <td data-label="Organization Email" className={`px-4 py-2 whitespace-nowrap text-sm ${theme.text.secondary}`}>{party.orgEmail || <span className={theme.text.muted}>N/A</span>}</td>
                    <td data-label="GST No." className={`px-4 py-2 whitespace-nowrap text-sm ${theme.text.secondary}`}>{party.gstNo}</td>
                    <td data-label="Actions" className="px-4 py-2 whitespace-nowrap text-sm text-right space-x-2">
                      <Button size="sm" variant="secondary" onClick={() => openModal(party)} aria-label={`Edit ${party.name}`}><EditIcon /></Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(party)} aria-label={`Delete ${party.name}`}><DeleteIcon /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              currentPage={partiesPagination.currentPage}
              totalPages={partiesPagination.totalPages}
              onPageChange={partiesPagination.setCurrentPage}
              totalItems={partiesPagination.totalItems}
              itemsPerPage={partiesPagination.itemsPerPage}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default PartiesPage;