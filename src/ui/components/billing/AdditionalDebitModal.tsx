import React, { useEffect, useMemo, useState } from 'react';
import { AdditionalDebit, Party } from '../../types';
import { additionalDebitsApi } from '../../utils/api';
import Button from '../common/Button';
import Input, { Select, Textarea } from '../common/Input';
import Modal from '../common/Modal';

interface AdditionalDebitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (debit: AdditionalDebit) => void;
  parties: Party[];
  preSelectedPartyId?: string;
}

const AdditionalDebitModal: React.FC<AdditionalDebitModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  parties,
  preSelectedPartyId
}) => {
  const [partyId, setPartyId] = useState(preSelectedPartyId || '');
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly'>('quarterly');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [debitDate, setDebitDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setPartyId(preSelectedPartyId || '');
      setPeriodType('quarterly');
      setDescription('');
      setAmount('');
      setDebitDate(new Date().toISOString().split('T')[0]);
      setErrors({});
    }
  }, [isOpen, preSelectedPartyId]);

  const selectedParty = useMemo(
    () => parties.find(p => p._id === partyId),
    [parties, partyId]
  );

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!partyId) nextErrors.partyId = 'Party name is required';
    if (!description.trim()) nextErrors.description = 'Particular / description is required';
    if (!amount || Number(amount) <= 0) nextErrors.amount = 'Amount must be greater than zero';
    if (!debitDate) nextErrors.debitDate = 'Date is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const { data } = await additionalDebitsApi.create({
        party: partyId,
        periodType,
        description: description.trim(),
        amount: Number(amount),
        debitDate,
      });
      onCreated(data);
    } catch (error: any) {
      setErrors(prev => ({ ...prev, submit: error?.message || 'Failed to create additional debit' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Additional Debit"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Debit'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Party Name</label>
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className="block w-full appearance-none rounded-lg border py-2 px-3 bg-theme-input text-theme-primary shadow-sm"
            >
              <option value="">Select party</option>
              {parties.map(party => (
                <option key={party._id} value={party._id}>{party.name}</option>
              ))}
            </select>
            {errors.partyId && <p className="mt-2 text-sm text-red-600">{errors.partyId}</p>}
          </div>
          <Select
            label="Monthly / Quarterly"
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as 'monthly' | 'quarterly')}
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </Select>
        </div>

        <Textarea
          label="Particular / Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Example: Rent adjustment for Apr-Jun"
          error={errors.description}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="75000"
            error={errors.amount}
          />
          <Input
            label="Date"
            type="date"
            value={debitDate}
            onChange={(e) => setDebitDate(e.target.value)}
            error={errors.debitDate}
          />
        </div>

        {selectedParty && (
          <div className="rounded-lg border border-theme-primary bg-theme-primary p-3 text-sm text-theme-secondary">
            This debit will reduce the effective warehouse charges shown for <strong className="text-theme-primary">{selectedParty.name}</strong>.
            No bill PDF will be created for this entry.
          </div>
        )}

        {errors.submit && <p className="text-sm text-red-600">{errors.submit}</p>}
      </div>
    </Modal>
  );
};

export default AdditionalDebitModal;
