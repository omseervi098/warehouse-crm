import React, { useCallback, useEffect, useState } from 'react';
import { useNotify } from '../../hooks/useNotify';
import { useTheme } from '../../hooks/useTheme';
import { Bill, Party, Payment } from '../../types';
import { billsApi, paymentsApi } from '../../utils/api';
import Button from '../common/Button';
import Modal from '../common/Modal';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPaymentCreated: (payment: Payment) => void;
    parties: Party[];
    preSelectedPartyId?: string;
}

interface PaymentFormData {
    partyId: string;
    billId: string;
    amount: number;
    paymentMethod: 'cash' | 'cheque' | 'bank_transfer';
    paymentDate: string;
    bankDetails: {
        bankName: string;
        accountNumber: string;
        chequeNumber: string;
        transactionId: string;
    };
    notes: string;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen,
    onClose,
    onPaymentCreated,
    parties,
    preSelectedPartyId
}) => {
    const { theme } = useTheme();
    const notify = useNotify();

    // Form state
    const [formData, setFormData] = useState<PaymentFormData>({
        partyId: preSelectedPartyId || '',
        billId: '',
        amount: 0,
        paymentMethod: 'cash',
        paymentDate: new Date().toISOString().split('T')[0],
        bankDetails: {
            bankName: '',
            accountNumber: '',
            chequeNumber: '',
            transactionId: ''
        },
        notes: ''
    });

    // UI state
    const [loading, setLoading] = useState(false);
    const [loadingBills, setLoadingBills] = useState(false);
    const [availableBills, setAvailableBills] = useState<Bill[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [createdPayment, setCreatedPayment] = useState<Payment | null>(null);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setFormData({
                partyId: preSelectedPartyId || '',
                billId: '',
                amount: 0,
                paymentMethod: 'cash',
                paymentDate: new Date().toISOString().split('T')[0],
                bankDetails: {
                    bankName: '',
                    accountNumber: '',
                    chequeNumber: '',
                    transactionId: ''
                },
                notes: ''
            });
            setErrors({});
            setAvailableBills([]);
            setCreatedPayment(null);
        }
    }, [isOpen, preSelectedPartyId]);

    // Load unpaid bills when party is selected
    useEffect(() => {
        if (formData.partyId && isOpen) {
            loadUnpaidBills(formData.partyId);
        }
    }, [formData.partyId, isOpen]);

    // Generate payment number
    const generatePaymentNumber = useCallback(() => {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const time = now.getTime().toString().slice(-6);
        return `PAY-${year}${month}${day}-${time}`;
    }, []);

    // Load unpaid bills for selected party
    const loadUnpaidBills = useCallback(async (partyId: string) => {
        setLoadingBills(true);
        try {
            const { data } = await billsApi.getAll({
                partyId,
                status: ['unpaid', 'partial'],
                limit: 1000
            });

            // Filter bills that have outstanding amounts
            const unpaidBills = data.bills.filter(bill => bill.outstandingAmount > 0);
            setAvailableBills(unpaidBills);

            // Reset bill selection if current bill is not in the new list
            if (formData.billId && !unpaidBills.find(bill => bill._id === formData.billId)) {
                setFormData(prev => ({ ...prev, billId: '', amount: 0 }));
            }
        } catch (error) {
            console.error('Error loading unpaid bills:', error);
            notify({
                type: 'error',
                message: 'Failed to load unpaid bills'
            });
            setAvailableBills([]);
        } finally {
            setLoadingBills(false);
        }
    }, [formData.billId, notify]);

    // Handle form field changes
    const handleFieldChange = useCallback((field: string, value: string | number) => {
        if (field.startsWith('bankDetails.')) {
            const bankField = field.split('.')[1];
            setFormData(prev => ({
                ...prev,
                bankDetails: {
                    ...prev.bankDetails,
                    [bankField]: value
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, [field]: value }));
        }

        // Clear error for this field
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }

        // Special handling for bill selection - auto-fill max amount
        if (field === 'billId' && value) {
            const selectedBill = availableBills.find(bill => bill._id === value);
            if (selectedBill) {
                setFormData(prev => ({
                    ...prev,
                    amount: selectedBill.outstandingAmount
                }));
            }
        }

        // Clear bank details when payment method changes to cash
        if (field === 'paymentMethod' && value === 'cash') {
            setFormData(prev => ({
                ...prev,
                bankDetails: {
                    bankName: '',
                    accountNumber: '',
                    chequeNumber: '',
                    transactionId: ''
                }
            }));
        }
    }, [errors, availableBills]);

    // Form validation
    const validateForm = useCallback((): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.partyId) {
            newErrors.partyId = 'Party is required';
        }

        if (!formData.billId) {
            newErrors.billId = 'Bill selection is required';
        }

        if (!formData.amount || formData.amount <= 0) {
            newErrors.amount = 'Payment amount must be greater than zero';
        }

        // Validate payment amount against outstanding bill amount
        if (formData.billId && formData.amount > 0) {
            const selectedBill = availableBills.find(bill => bill._id === formData.billId);
            if (selectedBill && formData.amount > selectedBill.outstandingAmount) {
                newErrors.amount = `Payment amount cannot exceed outstanding amount of ₹${selectedBill.outstandingAmount.toFixed(2)}`;
            }
        }

        if (!formData.paymentMethod) {
            newErrors.paymentMethod = 'Payment method is required';
        }

        if (!formData.paymentDate) {
            newErrors.paymentDate = 'Payment date is required';
        }

        // Validate payment date is not in future
        const paymentDate = new Date(formData.paymentDate);
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        if (paymentDate > today) {
            newErrors.paymentDate = 'Payment date cannot be in the future';
        }

        // Validate bank details for non-cash payments
        if (formData.paymentMethod !== 'cash') {
            if (formData.paymentMethod === 'cheque' && !formData.bankDetails.chequeNumber) {
                newErrors['bankDetails.chequeNumber'] = 'Cheque number is required';
            }
            if (formData.paymentMethod === 'bank_transfer' && !formData.bankDetails.transactionId) {
                newErrors['bankDetails.transactionId'] = 'Transaction ID is required';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData, availableBills]);

    // Handle form submission
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            const selectedParty = parties.find(p => p._id === formData.partyId);
            const selectedBill = availableBills.find(b => b._id === formData.billId);

            if (!selectedParty || !selectedBill) {
                throw new Error('Selected party or bill not found');
            }

            const paymentData = {
                paymentNumber: generatePaymentNumber(),
                bill: selectedBill._id,
                party: selectedParty._id,
                amount: formData.amount,
                paymentMethod: formData.paymentMethod,
                paymentDate: formData.paymentDate,
                bankDetails: formData.paymentMethod !== 'cash' ? {
                    bankName: formData.bankDetails.bankName || undefined,
                    accountNumber: formData.bankDetails.accountNumber || undefined,
                    chequeNumber: formData.bankDetails.chequeNumber || undefined,
                    transactionId: formData.bankDetails.transactionId || undefined
                } : undefined,
                notes: formData.notes || undefined
            };

            const { data: newPayment } = await paymentsApi.create(paymentData);

            setCreatedPayment(newPayment);

            notify({
                type: 'success',
                message: `Payment ${newPayment.paymentNumber} recorded successfully for ${selectedParty.name}`
            });

            onPaymentCreated(newPayment);
        } catch (error: any) {
            notify({
                type: 'error',
                message: error.message || 'Failed to record payment'
            });
        } finally {
            setLoading(false);
        }
    }, [formData, parties, availableBills, validateForm, generatePaymentNumber, notify, onPaymentCreated]);

    // Handle modal close
    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    const selectedParty = parties.find(p => p._id === formData.partyId);
    const selectedBill = availableBills.find(b => b._id === formData.billId);

    // Check if bank details are required
    const requiresBankDetails = formData.paymentMethod !== 'cash';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Record Payment"
            size="lg"
            footer={
                <div className="flex space-x-3">
                    <Button
                        variant="secondary"
                        onClick={handleClose}
                        disabled={loading}
                    >
                        {createdPayment ? 'Close' : 'Cancel'}
                    </Button>
                    {!createdPayment && (
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={loading || loadingBills}
                        >
                            {loading ? 'Recording Payment...' : 'Record Payment'}
                        </Button>
                    )}
                </div>
            }
        >
            {createdPayment ? (
                // Success state - show payment details
                <div className="space-y-6">
                    <div className={`p-4 rounded-lg ${theme.bg.secondary} border border-green-500`}>
                        <div className="flex items-center space-x-2 mb-3">
                            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <h3 className={`text-lg font-semibold ${theme.text.primary}`}>
                                Payment Recorded Successfully!
                            </h3>
                        </div>

                        <div className="space-y-2">
                            <p className={`${theme.text.secondary}`}>
                                <strong>Payment Number:</strong> {createdPayment.paymentNumber}
                            </p>
                            <p className={`${theme.text.secondary}`}>
                                <strong>Party:</strong> {createdPayment.party.name}
                            </p>
                            <p className={`${theme.text.secondary}`}>
                                <strong>Bill Number:</strong> {createdPayment.bill.billNumber}
                            </p>
                            <p className={`${theme.text.secondary}`}>
                                <strong>Amount:</strong> ₹{createdPayment.amount.toFixed(2)}
                            </p>
                            <p className={`${theme.text.secondary}`}>
                                <strong>Payment Method:</strong> {createdPayment.paymentMethod.toUpperCase()}
                            </p>
                        </div>
                    </div>

                    <div className={`p-4 rounded-lg ${theme.bg.tertiary} border ${theme.border.primary}`}>
                        <h4 className={`text-sm font-medium ${theme.text.primary} mb-2`}>
                            Payment Recorded
                        </h4>
                        <p className={`text-sm ${theme.text.secondary}`}>
                            The payment has been successfully recorded and the bill status has been updated.
                            The party's outstanding balance will be recalculated automatically.
                        </p>
                    </div>
                </div>
            ) : (
                // Form state - show payment recording form
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Party Selection */}
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
                            {parties.map((party, index) => (
                                <option key={party._id?.toString() || `party-${index}`} value={party._id}>
                                    {party.name}
                                </option>
                            ))}
                        </select>
                        {errors.partyId && (
                            <p className="mt-1 text-sm text-red-500">{errors.partyId}</p>
                        )}
                    </div>

                    {/* Bill Selection */}
                    <div>
                        <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                            Outstanding Bill *
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
                                {loadingBills ? 'Loading bills...' :
                                    !formData.partyId ? 'Select a party first' :
                                        availableBills.length === 0 ? 'No unpaid bills found' :
                                            'Select a bill...'}
                            </option>
                            {availableBills.map((bill, index) => (
                                <option key={bill._id?.toString() || `bill-${index}`} value={bill._id}>
                                    {bill.billNumber} - {bill.quarter} {bill.year} - ₹{bill.outstandingAmount.toFixed(2)} outstanding
                                </option>
                            ))}
                        </select>
                        {errors.billId && (
                            <p className="mt-1 text-sm text-red-500">{errors.billId}</p>
                        )}
                        {selectedParty && availableBills.length === 0 && !loadingBills && (
                            <p className={`mt-1 text-sm ${theme.text.muted}`}>
                                No unpaid bills found for {selectedParty.name}
                            </p>
                        )}
                    </div>

                    {/* Payment Amount */}
                    <div>
                        <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                            Payment Amount (₹) *
                        </label>
                        <input
                            type="text"
                            value={formData.amount.toString()}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (/^\d*$/.test(val)) {
                                    handleFieldChange('amount', val === '' ? 0 : parseInt(val, 10));
                                }
                            }}
                            className={`
              w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
              ${errors.amount ? 'border-red-500' : theme.border.primary}
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            `}
                            placeholder="0"
                            disabled={loading || !formData.billId}
                        />
                        {errors.amount && (
                            <p className="mt-1 text-sm text-red-500">{errors.amount}</p>
                        )}
                        {selectedBill && (
                            <p className={`mt-1 text-sm ${theme.text.muted}`}>
                                Outstanding amount: ₹{Math.floor(selectedBill.outstandingAmount)}
                            </p>
                        )}
                    </div>

                    {/* Payment Method */}
                    <div>
                        <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                            Payment Method *
                        </label>
                        <select
                            value={formData.paymentMethod}
                            onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
                            className={`
              w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
              ${errors.paymentMethod ? 'border-red-500' : theme.border.primary}
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            `}
                            disabled={loading}
                        >
                            <option value="cash">Cash</option>
                            <option value="cheque">Cheque</option>
                            <option value="bank_transfer">Bank Transfer</option>
                        </select>
                        {errors.paymentMethod && (
                            <p className="mt-1 text-sm text-red-500">{errors.paymentMethod}</p>
                        )}
                    </div>

                    {/* Bank Details (conditional) */}
                    {requiresBankDetails && (
                        <div className={`p-4 rounded-lg ${theme.bg.secondary} border ${theme.border.primary} space-y-4`}>
                            <h4 className={`text-sm font-medium ${theme.text.primary}`}>
                                Bank Details
                            </h4>

                            {/* Bank Name */}
                            <div>
                                <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                                    Bank Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.bankDetails.bankName}
                                    onChange={(e) => handleFieldChange('bankDetails.bankName', e.target.value)}
                                    className={`
                    w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                    ${errors['bankDetails.bankName'] ? 'border-red-500' : theme.border.primary}
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  `}
                                    placeholder="Enter bank name"
                                    disabled={loading}
                                />
                                {errors['bankDetails.bankName'] && (
                                    <p className="mt-1 text-sm text-red-500">{errors['bankDetails.bankName']}</p>
                                )}
                            </div>

                            {/* Account Number (optional) */}
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
                                    placeholder="Enter account number (optional)"
                                    disabled={loading}
                                />
                            </div>

                            {/* Cheque Number (for cheque payments) */}
                            {formData.paymentMethod === 'cheque' && (
                                <div>
                                    <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                                        Cheque Number *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.bankDetails.chequeNumber}
                                        onChange={(e) => handleFieldChange('bankDetails.chequeNumber', e.target.value)}
                                        className={`
                      w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                      ${errors['bankDetails.chequeNumber'] ? 'border-red-500' : theme.border.primary}
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    `}
                                        placeholder="Enter cheque number"
                                        disabled={loading}
                                    />
                                    {errors['bankDetails.chequeNumber'] && (
                                        <p className="mt-1 text-sm text-red-500">{errors['bankDetails.chequeNumber']}</p>
                                    )}
                                </div>
                            )}

                            {/* Transaction ID (for Bank Transfer) */}
                            {(formData.paymentMethod === 'bank_transfer') && (
                                <div>
                                    <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                                        Transaction ID *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.bankDetails.transactionId}
                                        onChange={(e) => handleFieldChange('bankDetails.transactionId', e.target.value)}
                                        className={`
                      w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                      ${errors['bankDetails.transactionId'] ? 'border-red-500' : theme.border.primary}
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    `}
                                        placeholder="Enter transaction ID"
                                        disabled={loading}
                                    />
                                    {errors['bankDetails.transactionId'] && (
                                        <p className="mt-1 text-sm text-red-500">{errors['bankDetails.transactionId']}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Payment Date */}
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
                        {errors.paymentDate && (
                            <p className="mt-1 text-sm text-red-500">{errors.paymentDate}</p>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                            Notes (Optional)
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
            )}
        </Modal>
    );
};

export default PaymentModal;