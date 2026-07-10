import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotify } from '../../hooks/useNotify';
import { useTheme } from '../../hooks/useTheme';
import { Bill, Party, Payment } from '../../types';
import { billsApi, paymentsApi } from '../../utils/api';
import { getFinancialYearOptions } from '../../utils/lotNumber';
import Button from '../common/Button';
import Modal from '../common/Modal';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPaymentCreated: (payment: Payment) => void;
    parties: Party[];
    preSelectedPartyId?: string;
}

type PaymentFor = 'bill_payment' | 'rent';
type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
type PaymentMethod = 'cash' | 'bank';

interface PaymentFormData {
    partyId: string;
    paymentFor: PaymentFor;
    billId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentDate: string;
    financialYear: number;
    quarter: Quarter;
    description: string;
    bankDetails: {
        bankName: string;
        accountNumber: string;
    };
    notes: string;
}

const getQuarterFromDate = (dateValue: string): Quarter => {
    const month = new Date(dateValue || new Date()).getMonth() + 1;
    if (month >= 4 && month <= 6) return 'Q1';
    if (month >= 7 && month <= 9) return 'Q2';
    if (month >= 10 && month <= 12) return 'Q3';
    return 'Q4';
};

const getFinancialYearStart = (dateValue: string): number => {
    const currentDate = dateValue ? new Date(dateValue) : new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    return month < 4 ? year - 1 : year;
};

const buildInitialFormData = (preSelectedPartyId?: string): PaymentFormData => {
    const today = new Date().toISOString().split('T')[0];
    return {
        partyId: preSelectedPartyId || '',
        paymentFor: 'bill_payment',
        billId: '',
        amount: 0,
        paymentMethod: 'cash',
        paymentDate: today,
        financialYear: getFinancialYearStart(today),
        quarter: getQuarterFromDate(today),
        description: '',
        bankDetails: {
            bankName: '',
            accountNumber: ''
        },
        notes: ''
    };
};

const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen,
    onClose,
    onPaymentCreated,
    parties,
    preSelectedPartyId
}) => {
    const { theme } = useTheme();
    const notify = useNotify();

    const [formData, setFormData] = useState<PaymentFormData>(buildInitialFormData(preSelectedPartyId));
    const [loading, setLoading] = useState(false);
    const [loadingBills, setLoadingBills] = useState(false);
    const [availableBills, setAvailableBills] = useState<Bill[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loadedBillsPartyId, setLoadedBillsPartyId] = useState('');

    useEffect(() => {
        if (isOpen) {
            setFormData(buildInitialFormData(preSelectedPartyId));
            setErrors({});
            setAvailableBills([]);
            setLoadedBillsPartyId('');
            setLoadingBills(false);
        }
    }, [isOpen, preSelectedPartyId]);

    const loadUnpaidBills = useCallback(async (partyId: string) => {
        setLoadingBills(true);
        try {
            const { data } = await billsApi.getAll({
                partyId,
                status: ['unpaid', 'partial'],
                limit: 1000
            });

            const unpaidBills = data.bills.filter((bill: Bill) => bill.outstandingAmount > 0);
            setAvailableBills(unpaidBills);
            setLoadedBillsPartyId(partyId);

            setFormData((prev) => {
                if (!prev.billId || unpaidBills.some((bill: Bill) => bill._id === prev.billId)) {
                    return prev;
                }

                return {
                    ...prev,
                    billId: '',
                    amount: prev.paymentFor === 'bill_payment' ? 0 : prev.amount
                };
            });
        } catch (error) {
            console.error('Error loading unpaid bills:', error);
            notify({
                type: 'error',
                message: 'Failed to load unpaid bills'
            });
            setAvailableBills([]);
            setLoadedBillsPartyId(partyId);
        } finally {
            setLoadingBills(false);
        }
    }, [notify]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (!formData.partyId) {
            setAvailableBills([]);
            setLoadedBillsPartyId('');
            setLoadingBills(false);
            return;
        }

        if (loadedBillsPartyId === formData.partyId) {
            return;
        }

        if (isOpen && formData.partyId) {
            void loadUnpaidBills(formData.partyId);
        }
    }, [formData.partyId, isOpen, loadUnpaidBills, loadedBillsPartyId]);

    const generatePaymentNumber = useCallback(() => {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const time = now.getTime().toString().slice(-6);
        return `PAY-${year}${month}${day}-${time}`;
    }, []);

    const handleFieldChange = useCallback((field: string, value: string | number) => {
        setFormData((prev) => {
            if (field.startsWith('bankDetails.')) {
                const bankField = field.split('.')[1] as keyof PaymentFormData['bankDetails'];
                return {
                    ...prev,
                    bankDetails: {
                        ...prev.bankDetails,
                        [bankField]: String(value)
                    }
                };
            }

            if (field === 'partyId') {
                return {
                    ...prev,
                    partyId: String(value),
                    billId: '',
                    amount: prev.paymentFor === 'bill_payment' ? 0 : prev.amount
                };
            }

            if (field === 'paymentFor') {
                const paymentFor = value as PaymentFor;
                const selectedBill = availableBills.find((bill) => bill._id === prev.billId);
                return {
                    ...prev,
                    paymentFor,
                    amount: paymentFor === 'bill_payment'
                        ? selectedBill?.outstandingAmount || 0
                        : prev.amount,
                    description: paymentFor === 'bill_payment' ? '' : prev.description
                };
            }

            if (field === 'billId') {
                const billId = String(value);
                const selectedBill = availableBills.find((bill) => bill._id === billId);
                return {
                    ...prev,
                    billId,
                    amount: prev.paymentFor === 'bill_payment' && selectedBill
                        ? selectedBill.outstandingAmount
                        : prev.paymentFor === 'bill_payment' && !billId
                            ? 0
                            : prev.amount
                };
            }

            if (field === 'paymentMethod') {
                const paymentMethod = value as PaymentMethod;
                return {
                    ...prev,
                    paymentMethod,
                    bankDetails: paymentMethod === 'cash'
                        ? { bankName: '', accountNumber: '' }
                        : prev.bankDetails
                };
            }

            if (field === 'paymentDate') {
                const paymentDate = String(value);
                return {
                    ...prev,
                    paymentDate,
                    financialYear: getFinancialYearStart(paymentDate),
                    quarter: getQuarterFromDate(paymentDate)
                };
            }

            if (field === 'amount') {
                return {
                    ...prev,
                    amount: typeof value === 'number' ? value : Number(value)
                };
            }

            if (field === 'financialYear') {
                return {
                    ...prev,
                    financialYear: Number(value)
                };
            }

            return {
                ...prev,
                [field]: value
            };
        });

        if (field === 'partyId') {
            setAvailableBills([]);
            setLoadedBillsPartyId('');
            setLoadingBills(false);
        }

        setErrors((prev) => {
            if (!prev[field]) {
                return prev;
            }

            const nextErrors = { ...prev };
            delete nextErrors[field];
            return nextErrors;
        });
    }, [availableBills]);

    const validateForm = useCallback((): boolean => {
        const nextErrors: Record<string, string> = {};

        if (!formData.partyId) {
            nextErrors.partyId = 'Party is required';
        }

        if (!formData.amount || formData.amount <= 0) {
            nextErrors.amount = 'Payment amount must be greater than zero';
        }

        const selectedBill = availableBills.find((bill) => bill._id === formData.billId);

        if (formData.paymentFor === 'bill_payment') {
            if (!formData.billId) {
                nextErrors.billId = 'Bill selection is required for bill payments';
            }

            if (selectedBill && formData.amount > selectedBill.outstandingAmount) {
                nextErrors.amount = `Payment amount cannot exceed outstanding amount of ₹${selectedBill.outstandingAmount.toFixed(2)}`;
            }
        } else {
            if (!formData.description.trim()) {
                nextErrors.description = 'Description is required for rent payments';
            }

            if (!formData.financialYear) {
                nextErrors.financialYear = 'Financial year is required';
            }

            if (!formData.quarter) {
                nextErrors.quarter = 'Quarter is required';
            }
        }

        if (!formData.paymentDate) {
            nextErrors.paymentDate = 'Payment date is required';
        } else {
            const paymentDate = new Date(formData.paymentDate);
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            if (paymentDate > today) {
                nextErrors.paymentDate = 'Payment date cannot be in the future';
            }
        }

        if (formData.paymentMethod === 'bank' && !formData.bankDetails.accountNumber.trim()) {
            nextErrors['bankDetails.accountNumber'] = 'Account number is required';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }, [availableBills, formData]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            const selectedParty = parties.find((party) => party._id === formData.partyId);
            const selectedBill = availableBills.find((bill) => bill._id === formData.billId);

            if (!selectedParty) {
                throw new Error('Selected party not found');
            }

            if (formData.paymentFor === 'bill_payment' && !selectedBill) {
                throw new Error('Selected bill not found');
            }

            const paymentData = {
                paymentNumber: generatePaymentNumber(),
                paymentFor: formData.paymentFor,
                bill: formData.billId || undefined,
                party: selectedParty._id,
                amount: formData.amount,
                paymentMethod: formData.paymentMethod,
                paymentDate: formData.paymentDate,
                financialYear: formData.paymentFor === 'rent' ? formData.financialYear : undefined,
                quarter: formData.paymentFor === 'rent' ? formData.quarter : undefined,
                description: formData.paymentFor === 'rent' ? formData.description.trim() : undefined,
                bankDetails: formData.paymentMethod !== 'cash'
                    ? {
                        bankName: formData.bankDetails.bankName.trim() || undefined,
                        accountNumber: formData.bankDetails.accountNumber.trim() || undefined
                    }
                    : undefined,
                notes: formData.notes.trim() || undefined
            };

            const { data: newPayment } = await paymentsApi.create(paymentData);
            onPaymentCreated(newPayment);
        } catch (error: any) {
            notify({
                type: 'error',
                message: error.message || 'Failed to record payment'
            });
        } finally {
            setLoading(false);
        }
    }, [availableBills, formData, generatePaymentNumber, notify, onPaymentCreated, parties, validateForm]);

    const selectedParty = useMemo(
        () => parties.find((party) => party._id === formData.partyId),
        [formData.partyId, parties]
    );

    const selectedBill = useMemo(
        () => availableBills.find((bill) => bill._id === formData.billId),
        [availableBills, formData.billId]
    );

    const requiresBankDetails = formData.paymentMethod !== 'cash';
    const paymentTypeLabel = formData.paymentFor === 'rent' ? 'Rent' : 'Bill Payment';
    const financialYearOptions = useMemo(
        () => getFinancialYearOptions(formData.paymentDate || new Date(), 2, 2).map((financialYear) => {
            const [startYear] = financialYear.split('-');
            const currentCentury = Math.floor(new Date().getFullYear() / 100) * 100;
            return {
                label: financialYear,
                value: currentCentury + Number(startYear)
            };
        }),
        [formData.paymentDate]
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Record Payment"
            size="xl"
            footer={
                <div className="flex space-x-3">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={loading || loadingBills}
                    >
                        {loading ? 'Saving...' : `Save ${paymentTypeLabel}`}
                    </Button>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6 pb-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                            Party *
                        </label>
                        <select
                            value={formData.partyId}
                            onChange={(e) => handleFieldChange('partyId', e.target.value)}
                            className={`
                                w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                                ${errors.partyId ? 'border-red-500' : theme.border.primary}
                                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            `}
                            disabled={loading}
                        >
                            <option value="">Select a party...</option>
                            {parties.map((party) => (
                                <option key={party._id} value={party._id}>
                                    {party.name}
                                </option>
                            ))}
                        </select>
                        {errors.partyId && (
                            <p className="mt-1 text-sm text-red-500">{errors.partyId}</p>
                        )}
                    </div>

                    <div>
                        <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                            Payment Type *
                        </label>
                        <select
                            value={formData.paymentFor}
                            onChange={(e) => handleFieldChange('paymentFor', e.target.value)}
                            className={`
                                w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                                ${theme.border.primary}
                                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            `}
                            disabled={loading}
                        >
                            <option value="bill_payment">Bill Payment</option>
                            <option value="rent">Rent</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                        {formData.paymentFor === 'bill_payment' ? 'Bill *' : 'Bill (Optional)'}
                    </label>
                    <select
                        value={formData.billId}
                        onChange={(e) => handleFieldChange('billId', e.target.value)}
                        className={`
                            w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                            ${errors.billId ? 'border-red-500' : theme.border.primary}
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        `}
                        disabled={loading || loadingBills || !formData.partyId}
                    >
                        <option value="">
                            {loadingBills
                                ? 'Loading bills...'
                                : !formData.partyId
                                    ? 'Select a party first'
                                    : availableBills.length === 0
                                        ? 'No unpaid bills found'
                                        : formData.paymentFor === 'bill_payment'
                                            ? 'Select a bill...'
                                            : 'No bill linked'}
                        </option>
                        {availableBills.map((bill) => (
                            <option key={bill._id} value={bill._id}>
                                {bill.billNumber} - {bill.quarter} {bill.year} - ₹{bill.outstandingAmount.toFixed(2)} outstanding
                            </option>
                        ))}
                    </select>
                    <div className="mt-1 min-h-5">
                        {errors.billId ? (
                            <p className="text-sm text-red-500">{errors.billId}</p>
                        ) : selectedParty && availableBills.length === 0 && !loadingBills ? (
                            <p className={`text-sm ${theme.text.muted}`}>
                                No unpaid bills found for {selectedParty.name}
                            </p>
                        ) : null}
                    </div>
                </div>

                {formData.paymentFor === 'rent' && (
                    <div className={`p-4 rounded-lg ${theme.bg.secondary} border ${theme.border.primary} space-y-4`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                                    Financial Year *
                                </label>
                                <select
                                    value={formData.financialYear}
                                    onChange={(e) => handleFieldChange('financialYear', Number(e.target.value))}
                                    className={`
                                        w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                                        ${errors.financialYear ? 'border-red-500' : theme.border.primary}
                                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                    `}
                                    disabled={loading}
                                >
                                    {financialYearOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                {errors.financialYear && (
                                    <p className="mt-1 text-sm text-red-500">{errors.financialYear}</p>
                                )}
                            </div>

                            <div>
                                <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                                    Quarter *
                                </label>
                                <select
                                    value={formData.quarter}
                                    onChange={(e) => handleFieldChange('quarter', e.target.value)}
                                    className={`
                                        w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                                        ${errors.quarter ? 'border-red-500' : theme.border.primary}
                                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                    `}
                                    disabled={loading}
                                >
                                    <option value="Q1">Q1 (Apr-Jun)</option>
                                    <option value="Q2">Q2 (Jul-Sep)</option>
                                    <option value="Q3">Q3 (Oct-Dec)</option>
                                    <option value="Q4">Q4 (Jan-Mar)</option>
                                </select>
                                {errors.quarter && (
                                    <p className="mt-1 text-sm text-red-500">{errors.quarter}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                                Description *
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => handleFieldChange('description', e.target.value)}
                                rows={3}
                                className={`
                                    w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                                    ${errors.description ? 'border-red-500' : theme.border.primary}
                                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                    resize-none
                                `}
                                placeholder="Example: Rent payment for Q1"
                                disabled={loading}
                            />
                            {errors.description && (
                                <p className="mt-1 text-sm text-red-500">{errors.description}</p>
                            )}
                        </div>
                    </div>
                )}

                <div>
                    <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                        Amount (₹) *
                    </label>
                    <input
                        type="text"
                        value={formData.amount === 0 ? '' : String(formData.amount)}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (/^\d*\.?\d*$/.test(value)) {
                                handleFieldChange('amount', value === '' ? 0 : Number(value));
                            }
                        }}
                        className={`
                            w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                            ${errors.amount ? 'border-red-500' : theme.border.primary}
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        `}
                        placeholder="0"
                        disabled={loading || (formData.paymentFor === 'bill_payment' && !formData.billId)}
                    />
                    <div className="mt-1 min-h-5">
                        {errors.amount ? (
                            <p className="text-sm text-red-500">{errors.amount}</p>
                        ) : selectedBill ? (
                            <p className={`text-sm ${theme.text.muted}`}>
                                Outstanding amount: ₹{selectedBill.outstandingAmount.toFixed(2)}
                            </p>
                        ) : null}
                    </div>
                </div>

                <div>
                    <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                        Payment Method *
                    </label>
                    <select
                        value={formData.paymentMethod}
                        onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
                        className={`
                            w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                            ${theme.border.primary}
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        `}
                        disabled={loading}
                    >
                        <option value="cash">Cash</option>
                        <option value="bank">Bank Transfer</option>
                    </select>
                </div>

                {requiresBankDetails && (
                    <div className={`p-4 rounded-lg ${theme.bg.secondary} border ${theme.border.primary} space-y-4`}>
                        <h4 className={`text-sm font-medium ${theme.text.primary}`}>
                            Bank Details
                        </h4>

                        <div>
                            <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                                Bank Name
                            </label>
                            <input
                                type="text"
                                value={formData.bankDetails.bankName}
                                onChange={(e) => handleFieldChange('bankDetails.bankName', e.target.value)}
                                className={`
                                    w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                                    ${theme.border.primary}
                                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                `}
                                placeholder="Enter bank name"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                                Account Number
                            </label>
                            <input
                                type="text"
                                value={formData.bankDetails.accountNumber}
                                onChange={(e) => handleFieldChange('bankDetails.accountNumber', e.target.value)}
                                className={`
                                    w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                                    ${theme.border.primary}
                                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                `}
                                placeholder="Bank Account Number"
                                disabled={loading}
                            />
                        </div>
                    </div>
                )}

                <div>
                    <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                        Payment Date *
                    </label>
                    <input
                        type="date"
                        value={formData.paymentDate}
                        onChange={(e) => handleFieldChange('paymentDate', e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className={`
                            w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                            ${errors.paymentDate ? 'border-red-500' : theme.border.primary}
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        `}
                        disabled={loading}
                    />
                    <div className="mt-1 min-h-5">
                        {errors.paymentDate ? (
                            <p className="text-sm text-red-500">{errors.paymentDate}</p>
                        ) : null}
                    </div>
                </div>

                <div>
                    <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                        Notes
                    </label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => handleFieldChange('notes', e.target.value)}
                        rows={3}
                        className={`
                            w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                            ${theme.border.primary}
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            resize-none
                        `}
                        placeholder="Optional notes about this payment"
                        disabled={loading}
                    />
                </div>
            </form>
        </Modal>
    );
};

export default PaymentModal;
