
import { Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import Button from '../components/common/Button';
import Input, { Textarea } from '../components/common/Input';
import PageHeader from '../components/common/PageHeader';
import { useAppContext } from '../contexts/AppContext';
import { useNotify } from '../hooks/useNotify';
import { useTheme } from '../hooks/useTheme';
import { CompanyProfileData } from '../types';

const InfoField: React.FC<{ label: string, value: string | undefined | null }> = ({ label, value }) => {
  const { theme } = useTheme();
  return (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
      <dt className={`text-sm font-medium leading-6 ${theme.text.secondary}`}>{label}</dt>
      <dd className={`mt-1 text-sm leading-6 ${theme.text.primary} font-medium sm:col-span-2 sm:mt-0`}>{value || <span className={theme.text.muted}>N/A</span>}</dd>
    </div>
  );
};

const EMPTY_PROFILE: CompanyProfileData = {
  _id: '',
  warehouseName: '',
  ownerName: '',
  contactNos: [],
  email: '',
  address: '',
  gstNo: '',
  panNo: '',
};

const CompanyProfilePage: React.FC = () => {
  const notify = useNotify();
  const { theme } = useTheme();
  const { companyProfile, updateCompanyProfile } = useAppContext();
  const [formData, setFormData] = useState<CompanyProfileData>(companyProfile || EMPTY_PROFILE);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (companyProfile) {
      setFormData(companyProfile);
    }
  }, [companyProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleContactNoChange = (index: number, value: string) => {
    const newContactNos = [...(formData.contactNos || [])];
    newContactNos[index] = value;
    setFormData(prev => ({ ...prev, contactNos: newContactNos }));
  };

  const addContactNo = () => {
    setFormData(prev => ({
      ...prev,
      contactNos: [...(prev.contactNos || []), '']
    }));
  };

  const removeContactNo = (index: number) => {
    const newContactNos = [...(formData.contactNos || [])];
    newContactNos.splice(index, 1);
    setFormData(prev => ({
      ...prev,
      contactNos: newContactNos
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateCompanyProfile(formData);
      setIsEditing(false);
    } catch (error) {
      notify({ type: 'error', message: 'Failed to update profile.' });
    }
  };

  return (
    <div>
      <PageHeader title="Company Profile">
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} variant="secondary">Edit Profile</Button>
        )}
      </PageHeader>

      <div className={`${theme.bg.card} p-8 rounded-xl shadow-sm border ${theme.border.primary}`}>
        {isEditing ? (
          <form onSubmit={handleSubmit}>
            <div className="space-y-12">
              <div className="border-b border-slate-900/10 pb-12">
                <h2 className={`text-base font-semibold leading-7 ${theme.text.primary}`}>Basic Information</h2>
                <p className={`mt-1 text-sm leading-6 ${theme.text.secondary}`}>Update your warehouse's profile and address.</p>
                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                  <Input label="Warehouse Name" name="warehouseName" value={formData.warehouseName} onChange={handleChange} required />
                  <Input label="Owner Name" name="ownerName" value={formData.ownerName} onChange={handleChange} />
                  <div className="md:col-span-2">
                    <Textarea label="Address" name="address" value={formData.address} onChange={handleChange} />
                  </div>
                </div>
              </div>

              <div className="border-b border-slate-900/10 pb-12">
                <h2 className={`text-base font-semibold leading-7 ${theme.text.primary}`}>Contact Details</h2>
                <p className={`mt-1 text-sm leading-6 ${theme.text.secondary}`}>How to get in touch with the business.</p>
                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />

                  <div className="md:col-span-2 space-y-2">
                    <label className={`block text-sm font-medium ${theme.text.secondary}`}>Contact Numbers</label>
                    <div className="space-y-2">
                      {(formData.contactNos || []).map((contact, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            type="tel"
                            value={contact}
                            onChange={(e) => handleContactNoChange(index, e.target.value)}
                            className="flex-1"
                            placeholder="Enter contact number"
                          />
                          <button
                            type="button"
                            onClick={() => removeContactNo(index)}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addContactNo}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Plus className="mr-1 h-3 w-3" /> Add Contact Number
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pb-12">
                <h2 className={`text-base font-semibold leading-7 ${theme.text.primary}`}>Bank & Tax Information</h2>
                <p className={`mt-1 text-sm leading-6 ${theme.text.secondary}`}>Financial and tax-related information.</p>
                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                  <Input label="GST No." name="gstNo" value={formData.gstNo} onChange={handleChange} />
                  <Input label="PAN No." name="panNo" value={formData.panNo} onChange={handleChange} />
                </div>
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-8">
                  <Input label="Bank Name" name="bankName" value={formData.bankName} onChange={handleChange} />
                  <Input label="Account Number" name="accountNumber" value={formData.accountNumber} onChange={handleChange} />
                  <Input label="IFSC Code" name="ifscCode" value={formData.ifscCode} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-x-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsEditing(false);
                  if (companyProfile) {
                    setFormData(companyProfile);
                  }
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">Save Changes</Button>
            </div>
          </form>
        ) : (
          <div className="divide-y divide-slate-200">
            <dl className="divide-y divide-slate-200">
              <InfoField label="Warehouse Name" value={companyProfile?.warehouseName} />
              <InfoField label="Owner Name" value={companyProfile?.ownerName} />
              <InfoField label="Address" value={companyProfile?.address} />
              <InfoField label="Email" value={companyProfile?.email} />
              {companyProfile?.contactNos?.map((contact, index) => (
                <InfoField
                  key={index}
                  label={`Contact ${index + 1}`}
                  value={contact || 'Not provided'}
                />
              ))}
              <InfoField label="GST No." value={companyProfile?.gstNo} />
              <InfoField label="PAN No." value={companyProfile?.panNo} />
              {companyProfile?.bankName && (
                <InfoField label="Bank Name" value={companyProfile?.bankName} />
              )}
              {companyProfile?.accountNumber && (
                <InfoField label="Account Number" value={companyProfile?.accountNumber} />
              )}
              {companyProfile?.ifscCode && (
                <InfoField label="IFSC Code" value={companyProfile?.ifscCode} />
              )}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyProfilePage;