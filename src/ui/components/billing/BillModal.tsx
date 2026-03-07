import React, { useCallback, useEffect, useState } from 'react';
import { useNotify } from '../../hooks/useNotify';
import { useTheme } from '../../hooks/useTheme';
import { Bill, Charge, Party } from '../../types';
import { billsApi, chargesApi } from '../../utils/api';
import { downloadBillPdf } from '../../utils/exportpdf';
import { generateAbbreviation, getFinancialYearString } from '../../utils/lotNumber';
import Button from '../common/Button';
import Modal from '../common/Modal';

interface BillModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBillCreated: (bill: Bill) => void;
    parties: Party[];
    preSelectedPartyId?: string;
}

interface BillFormData {
    partyId: string;
    quarter: string;
    year: number;
    amount: number;
    billDate: string;
    isSplit: boolean;
    particulars: string;
    billNumberSequence: string;
    billFinancialYear: string;
}

const BillModal: React.FC<BillModalProps> = ({
    isOpen,
    onClose,
    onBillCreated,
    parties,
    preSelectedPartyId
}) => {
    const { theme } = useTheme();
    const notify = useNotify();

    // Form state
    const [formData, setFormData] = useState<BillFormData>({
        partyId: preSelectedPartyId || '',
        quarter: 'Q' + (new Date().getMonth() < 3 ? 4 : Math.floor(new Date().getMonth() / 3)).toString(),
        year: new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear(),
        amount: 0,
        billDate: new Date().toISOString().split('T')[0],
        isSplit: true,
        particulars: "WAREHOUSING CHARGES\nFOR YOUR MATERIALS\nSTORED FOR APP. 2000 SQ.\nFT. ON MONTHLY RENTAL\nBASIS.",
        billNumberSequence: '01',
        billFinancialYear: getFinancialYearString(new Date())
    });

    const selectedParty = parties.find(p => p._id === formData.partyId);

    // UI state
    const [loading, setLoading] = useState(false);
    const [loadingSuggestion, setLoadingSuggestion] = useState(false);
    const [suggestedAmount, setSuggestedAmount] = useState<number | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [createdBill, setCreatedBill] = useState<Bill | null>(null);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [availableCharges, setAvailableCharges] = useState<Charge[]>([]);
    const [selectedCharges, setSelectedCharges] = useState<Charge[]>([]);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setFormData({
                partyId: preSelectedPartyId || '',
                quarter: 'Q' + (new Date().getMonth() < 3 ? 4 : Math.floor(new Date().getMonth() / 3)).toString(),
                year: new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear(),
                amount: 0,
                billDate: new Date().toISOString().split('T')[0],
                isSplit: true,
                particulars: "WAREHOUSING CHARGES\nFOR YOUR MATERIALS\nSTORED FOR APP. 2000 SQ.\nFT. ON MONTHLY RENTAL\nBASIS.",
                billNumberSequence: '01',
                billFinancialYear: getFinancialYearString(new Date())
            });
            setErrors({});
            setSuggestedAmount(null);
            setCreatedBill(null);
            setGeneratingPdf(false);
            setAvailableCharges([]);
            setSelectedCharges([]);
        }
    }, [isOpen, preSelectedPartyId]);

    // Generate bill number prefix
    const getBillNumberPrefix = useCallback(() => {
        if (!selectedParty) return '';
        const partyAbbr = generateAbbreviation(selectedParty.name, 3);
        const financialYear = formData.billFinancialYear;
        return `${partyAbbr}|${financialYear}|`;
    }, [selectedParty, formData.billFinancialYear]);

    // Construct full bill number
    const getFullBillNumber = useCallback(() => {
        const prefix = getBillNumberPrefix();
        return `${prefix}${formData.billNumberSequence}`;
    }, [getBillNumberPrefix, formData.billNumberSequence]);

    // Fetch existing bills and calculate next sequence
    useEffect(() => {
        const fetchExistingBills = async () => {
            if (!formData.partyId) return;

            try {
                // Fetch bills for this party
                // We'll fetch a larger number to ensure we get the latest
                const { data } = await billsApi.getAll({
                    partyId: formData.partyId,
                    limit: 100,
                    sort: 'billNumber',
                    order: 'desc'
                });

                if (data && data.bills) {
                    const prefix = getBillNumberPrefix();
                    const existingNumbers = data.bills
                        .map(b => b.billNumber)
                        .filter(num => num.startsWith(prefix));

                    // Calculate next sequence
                    let maxSequence = 0;
                    existingNumbers.forEach(num => {
                        const parts = num.split('|');
                        if (parts.length >= 3) {
                            const seq = parseInt(parts[2]);
                            if (!isNaN(seq) && seq > maxSequence) {
                                maxSequence = seq;
                            }
                        }
                    });

                    const nextSeq = (maxSequence + 1).toString().padStart(2, '0');
                    setFormData(prev => ({ ...prev, billNumberSequence: nextSeq }));
                }
            } catch (error) {
                console.error('Error fetching existing bills:', error);
            }
        };

        fetchExistingBills();
    }, [formData.partyId, getBillNumberPrefix]);

    // Calculate suggested amount from charges
    const calculateSuggestedAmount = useCallback(async (partyId: string, quarter: string, year: number) => {
        if (!partyId) return;

        setLoadingSuggestion(true);
        try {
            // Use the new API to get only unbilled charges for the specific quarter/year
            const { data: unbilledCharges } = await chargesApi.getUnbilledCharges(partyId, quarter, year);

            const chargesArray = Array.isArray(unbilledCharges) ? unbilledCharges : [];
            setAvailableCharges(chargesArray);

            // Calculate total from unbilled charges
            const totalAmount = chargesArray.reduce((sum: number, charge: Charge) => sum + charge.totalCharge, 0);
            setSuggestedAmount(totalAmount);

            // Auto-select all available charges by default
            setSelectedCharges(chargesArray);

            // Auto-fill amount if not manually set
            if (formData.amount === 0) {
                setFormData(prev => ({ ...prev, amount: totalAmount }));
            }
        } catch (error) {
            console.error('Error calculating suggested amount:', error);
            setSuggestedAmount(0);
            setAvailableCharges([]);
            setSelectedCharges([]);

            // Fallback to old method if new API is not available
            try {
                const { data: charges } = await chargesApi.getByParty(partyId);

                // Filter charges by quarter and year (Financial Year)
                // FY starts in April. Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar (next year)
                const quarterMonths = {
                    Q1: [4, 5, 6],
                    Q2: [7, 8, 9],
                    Q3: [10, 11, 12],
                    Q4: [1, 2, 3]
                };

                const relevantCharges = (charges as Charge[]).filter((charge: Charge) => {
                    const chargeDate = new Date(charge.anchorDate);
                    const chargeYear = chargeDate.getFullYear();
                    const chargeMonth = chargeDate.getMonth() + 1;

                    // For Q1, Q2, Q3: logic is same year
                    // For Q4: logic is next year
                    const targetYear = quarter === 'Q4' ? year + 1 : year;

                    return chargeYear === targetYear && quarterMonths[quarter as keyof typeof quarterMonths].includes(chargeMonth);
                });

                const totalAmount = relevantCharges.reduce((sum: number, charge: Charge) => sum + charge.totalCharge, 0);
                setSuggestedAmount(totalAmount);
                setAvailableCharges(relevantCharges);
                setSelectedCharges(relevantCharges);

                // Auto-fill amount if not manually set
                if (formData.amount === 0) {
                    setFormData(prev => ({ ...prev, amount: totalAmount }));
                }
            } catch (fallbackError) {
                console.error('Fallback method also failed:', fallbackError);
            }
        } finally {
            setLoadingSuggestion(false);
        }
    }, [formData.amount]);

    // Handle form field changes
    const handleFieldChange = useCallback((field: keyof BillFormData, value: string | number | boolean) => {
        setFormData(prev => {
            const newData = { ...prev, [field]: value };

            // Auto-update particulars when isSplit changes, ONLY if using one of the defaults
            if (field === 'isSplit') {
                const defaultSplit = "WAREHOUSING CHARGES\nFOR YOUR MATERIALS\nSTORED FOR APP. 2000 SQ.\nFT. ON MONTHLY RENTAL\nBASIS.";
                const defaultSingle = "WAREHOUSING CHARGES\nFOR 'EXTRA SPACE'\nPROVIDED FOR YOUR\nMATERIALS STORED FOR THE\nPERIOD.";

                // If switching to split and current is default single, update to default split
                if (value === true && (prev.particulars === defaultSingle || prev.particulars === '')) {
                    newData.particulars = defaultSplit;
                }
                // If switching to single and current is default split, update to default single
                else if (value === false && (prev.particulars === defaultSplit || prev.particulars === '')) {
                    newData.particulars = defaultSingle;
                }
            }

            return newData;
        });

        // Clear error for this field
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }

        // Recalculate suggestion when party, quarter, or year changes
        if (field === 'partyId' || field === 'quarter' || field === 'year') {
            const updatedData = { ...formData, [field]: value };
            if (updatedData.partyId && updatedData.quarter && updatedData.year) {
                calculateSuggestedAmount(updatedData.partyId, updatedData.quarter, updatedData.year);
            }
        }

        // Update financial year when bill date changes
        if (field === 'billDate') {
            setFormData(prev => ({
                ...prev,
                billFinancialYear: getFinancialYearString(new Date(value as string))
            }));
        }
    }, [formData, errors, calculateSuggestedAmount]);

    // Form validation
    const validateForm = useCallback((): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.partyId) {
            newErrors.partyId = 'Party is required';
        }

        if (!formData.quarter) {
            newErrors.quarter = 'Quarter is required';
        }

        if (!formData.year || formData.year < 2000 || formData.year > 2100) {
            newErrors.year = 'Valid year is required';
        }

        if (!formData.amount || formData.amount <= 0) {
            newErrors.amount = 'Amount must be greater than zero';
        }

        if (!formData.billDate) {
            newErrors.billDate = 'Bill date is required';
        }

        // Validate charge selection consistency
        if (selectedCharges.length > 0) {
            const selectedChargesTotal = selectedCharges.reduce((sum, c) => sum + c.totalCharge, 0);
            if (Math.abs(formData.amount - selectedChargesTotal) > 0.01) {
                newErrors.amount = `Amount (₹${formData.amount.toFixed(2)}) doesn't match selected charges total (₹${selectedChargesTotal.toFixed(2)})`;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData, selectedCharges]);

    // Handle form submission
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            const selectedParty = parties.find(p => p._id === formData.partyId);
            if (!selectedParty) {
                throw new Error('Selected party not found');
            }

            // Validate selected charges before creating bill
            if (selectedCharges.length > 0) {
                const chargeIds = selectedCharges.map(c => String(c._id));
                const { data: validation } = await chargesApi.validateChargesForBilling(chargeIds);

                if (validation && typeof validation === 'object' && 'valid' in validation) {
                    const validationResult = validation as { valid: boolean; errors?: string[] };
                    if (!validationResult.valid) {
                        throw new Error(`Cannot create bill: ${validationResult.errors?.join(', ')}`);
                    }
                }
            }

            const billData = {
                billNumber: getFullBillNumber(),
                party: selectedParty._id,
                quarter: formData.quarter,
                year: formData.year,
                amount: formData.amount,
                billDate: formData.billDate,
                status: 'unpaid' as const,
                paidAmount: 0,
                outstandingAmount: formData.amount,
                isSplit: formData.isSplit,
                particulars: formData.particulars,
                includedCharges: selectedCharges.map(charge => ({
                    chargeId: charge._id,
                    lotNumber: charge.lotNumber,
                    amount: charge.totalCharge,
                    totalCharge: charge.totalCharge
                })),
                chargesSnapshot: selectedCharges.length > 0 ? {
                    totalChargesAmount: selectedCharges.reduce((sum, c) => sum + c.totalCharge, 0),
                    chargeCount: selectedCharges.length,
                    calculatedAt: new Date().toISOString()
                } : undefined
            };

            const { data: newBill } = await billsApi.create(billData);

            // Mark charges as billed
            if (selectedCharges.length > 0) {
                const chargeIds = selectedCharges.map(c => String(c._id));
                await chargesApi.markChargesAsBilled(chargeIds, newBill._id, newBill.billNumber);
            }

            setCreatedBill(newBill);

            // Automatically generate/preview PDF
            await handleGeneratePdfForBill(newBill);

            notify({
                type: 'success',
                message: `Bill ${newBill.billNumber} created and PDF generated successfully`
            });

            onBillCreated(newBill);
        } catch (error: any) {
            notify({
                type: 'error',
                message: error.message || 'Failed to create bill'
            });
        } finally {
            setLoading(false);
        }
    }, [formData, parties, validateForm, getFullBillNumber, notify, onBillCreated, selectedCharges]);

    // Handle suggested amount usage
    const useSuggestedAmount = useCallback(() => {
        if (suggestedAmount !== null) {
            setFormData(prev => ({ ...prev, amount: suggestedAmount }));
            // Select all available charges when using suggested amount
            setSelectedCharges(availableCharges);
        }
    }, [suggestedAmount, availableCharges]);

    // Handle charge selection
    const handleChargeSelection = useCallback((charge: Charge, selected: boolean) => {
        setSelectedCharges(prev => {
            const newSelection = selected
                ? [...prev, charge]
                : prev.filter(c => c._id !== charge._id);

            // Update amount based on selected charges
            const newAmount = newSelection.reduce((sum, c) => sum + c.totalCharge, 0);
            setFormData(prevForm => ({ ...prevForm, amount: newAmount }));

            return newSelection;
        });
    }, []);

    // Select all charges
    const selectAllCharges = useCallback(() => {
        setSelectedCharges(availableCharges);
        const totalAmount = availableCharges.reduce((sum, charge) => sum + charge.totalCharge, 0);
        setFormData(prev => ({ ...prev, amount: totalAmount }));
    }, [availableCharges]);

    // Clear all charge selections
    const clearChargeSelection = useCallback(() => {
        setSelectedCharges([]);
        setFormData(prev => ({ ...prev, amount: 0 }));
    }, []);

    // Helper for PDF generation
    const handleGeneratePdfForBill = async (bill: Bill) => {
        setGeneratingPdf(true);
        try {
            await downloadBillPdf(bill);
        } catch (error: any) {
            console.error('PDF Generation failed:', error);
            notify({
                type: 'error',
                message: 'Bill created but PDF generation failed: ' + error.message
            });
        } finally {
            setGeneratingPdf(false);
        }
    };

    // Handle PDF generation (Button click)
    const handleGeneratePdf = useCallback(async () => {
        if (!createdBill) return;
        await handleGeneratePdfForBill(createdBill);
        notify({
            type: 'success',
            message: 'Bill PDF generated successfully'
        });
    }, [createdBill, notify]);

    // Handle modal close
    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Create New Bill"
            size="lg"
            footer={
                <div className="flex space-x-3">
                    <Button
                        variant="secondary"
                        onClick={handleClose}
                        disabled={loading || generatingPdf}
                    >
                        {createdBill ? 'Close' : 'Cancel'}
                    </Button>
                    {!createdBill ? (
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? 'Creating Bill...' : 'Create Bill'}
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            onClick={handleGeneratePdf}
                            disabled={generatingPdf}
                        >
                            {generatingPdf ? 'Generating PDF...' : 'Generate PDF'}
                        </Button>
                    )}
                </div>
            }
        >
            {createdBill ? (
                // Success state - show bill details and PDF option
                <div className="space-y-6">
                    <div className={`p-4 rounded-lg ${theme.bg.secondary} border border-green-500`}>
                        <div className="flex items-center space-x-2 mb-3">
                            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <h3 className={`text-lg font-semibold ${theme.text.primary}`}>
                                Bill Created Successfully!
                            </h3>
                        </div>

                        <div className="space-y-2">
                            <p className={`${theme.text.secondary}`}>
                                <strong>Bill Number:</strong> {createdBill.billNumber}
                            </p>
                            <p className={`${theme.text.secondary}`}>
                                <strong>Party:</strong> {createdBill.party.name}
                            </p>
                            <p className={`${theme.text.secondary}`}>
                                <strong>Amount:</strong> ₹{createdBill.amount.toFixed(2)}
                            </p>
                            <p className={`${theme.text.secondary}`}>
                                <strong>Quarter:</strong> {createdBill.quarter} {createdBill.year}
                            </p>
                        </div>
                    </div>

                    <div className={`p-4 rounded-lg ${theme.bg.tertiary} border ${theme.border.primary}`}>
                        <h4 className={`text-sm font-medium ${theme.text.primary} mb-2`}>
                            Next Steps
                        </h4>
                        <ul className={`text-sm ${theme.text.secondary} space-y-1`}>
                            <li>• Generate and download the PDF invoice</li>
                            <li>• Send the invoice to the party</li>
                            <li>• Record payments when received</li>
                        </ul>
                    </div>
                </div>
            ) : (
                // Form state - show bill creation form
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

                    {/* Bill Number Construction */}
                    {formData.partyId && (
                        <div>
                            <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                                Bill Number *
                            </label>
                            <div className="flex items-center gap-1">
                                <div className={`h-10 px-3 border ${theme.border.primary} ${theme.bg.secondary} rounded-md text-sm text-center flex items-center justify-center font-mono`} title="Party Abbreviation">
                                    {generateAbbreviation(selectedParty?.name || '', 3)}
                                </div>
                                <div className={`text-${theme.text.muted}`}>|</div>
                                <div className="w-24">
                                    <input
                                        type="text"
                                        value={formData.billFinancialYear}
                                        onChange={(e) => handleFieldChange('billFinancialYear', e.target.value)}
                                        className={`
                                            w-full h-10 px-3 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                                            ${theme.border.primary} font-mono text-center
                                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                        `}
                                        placeholder="YY-YY"
                                    />
                                </div>
                                <div className={`text-${theme.text.muted}`}>|</div>
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={formData.billNumberSequence}
                                        onChange={(e) => handleFieldChange('billNumberSequence', e.target.value)}
                                        className={`
                                            w-full h-10 px-3 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                                            ${theme.border.primary} font-mono
                                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                        `}
                                        placeholder="Seq"
                                    />
                                </div>
                            </div>
                            <p className={`mt-1 text-xs ${theme.text.muted}`}>
                                Full Bill Number: <span className="font-mono font-medium">{getFullBillNumber()}</span>
                            </p>
                        </div>
                    )}

                    {/* Quarter and Year */}
                    <div className="grid grid-cols-2 gap-4">
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

                        <div>
                            <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                                Year *
                            </label>
                            <select
                                value={formData.year}
                                onChange={(e) => handleFieldChange('year', parseInt(e.target.value))}
                                className={`
                w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                ${errors.year ? 'border-red-500' : theme.border.primary}
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              `}
                                disabled={loading}
                            >
                                {Array.from({ length: 5 }, (_, i) => {
                                    let year = new Date().getFullYear() - i;
                                    const month = new Date().getMonth();
                                    let nextYear = year + 1;
                                    if (month < 3) {
                                        nextYear = year;
                                        year = year - 1;
                                    }
                                    const label = `${year.toString().slice(-2)}-${nextYear.toString().slice(-2)}`;
                                    return (
                                        <option key={year} value={year}>
                                            {label}
                                        </option>
                                    );
                                })}
                            </select>
                            {errors.year && (
                                <p className="mt-1 text-sm text-red-500">{errors.year}</p>
                            )}
                        </div>
                    </div>

                    {/* Suggested Amount Display */}
                    {formData.partyId && formData.quarter && formData.year && (
                        <div className={`p-4 rounded-lg ${theme.bg.secondary} border ${theme.border.primary}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className={`text-sm font-medium ${theme.text.primary}`}>
                                        Suggested Amount
                                    </h4>
                                    <p className={`text-xs ${theme.text.muted} mt-1`}>
                                        Based on charges for {selectedParty?.name} in {formData.quarter} {formData.year}
                                    </p>
                                </div>
                                <div className="text-right">
                                    {loadingSuggestion ? (
                                        <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                                    ) : (
                                        <>
                                            <div className={`text-lg font-semibold ${theme.text.primary}`}>
                                                ₹{suggestedAmount?.toFixed(2) || '0.00'}
                                            </div>
                                            {suggestedAmount !== null && suggestedAmount !== formData.amount && (
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={useSuggestedAmount}
                                                    className="mt-1"
                                                >
                                                    Use This Amount
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Available Charges Selection */}
                    {availableCharges.length > 0 && (
                        <div className={`p-4 rounded-lg ${theme.bg.secondary} border ${theme.border.primary}`}>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className={`text-sm font-medium ${theme.text.primary}`}>
                                    Available Charges ({availableCharges.length})
                                </h4>
                                <div className="flex space-x-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={selectAllCharges}
                                        disabled={selectedCharges.length === availableCharges.length}
                                    >
                                        Select All
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={clearChargeSelection}
                                        disabled={selectedCharges.length === 0}
                                    >
                                        Clear All
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {availableCharges.map((charge, index) => {
                                    const isSelected = selectedCharges.some(c => c._id === charge._id);
                                    return (
                                        <div
                                            key={`charge-${charge.lotNumber}-${index}`}
                                            className={`
                                                flex items-center justify-between p-3 rounded border cursor-pointer
                                                ${isSelected
                                                    ? `${theme.bg.primary} border-blue-500`
                                                    : `${theme.bg.tertiary} ${theme.border.primary} hover:${theme.bg.primary}`
                                                }
                                            `}
                                            onClick={() => handleChargeSelection(charge, !isSelected)}
                                        >
                                            <div className="flex items-center space-x-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => handleChargeSelection(charge, e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <div>
                                                    <div className={`text-sm font-medium ${theme.text.primary}`}>
                                                        {charge.item.name} - {charge.lotNumber}
                                                    </div>
                                                    <div className={`text-xs ${theme.text.muted}`}>
                                                        {charge.quantity} {charge.unit.name} • {new Date(charge.anchorDate).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`text-sm font-semibold ${theme.text.primary}`}>
                                                ₹{charge.totalCharge.toFixed(2)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className={`mt-3 pt-3 border-t ${theme.border.primary} flex justify-between items-center`}>
                                <span className={`text-sm ${theme.text.secondary}`}>
                                    Selected: {selectedCharges.length} of {availableCharges.length} charges
                                </span>
                                <span className={`text-sm font-semibold ${theme.text.primary}`}>
                                    Total: ₹{selectedCharges.reduce((sum, c) => sum + c.totalCharge, 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* No Charges Available Message */}
                    {formData.partyId && formData.quarter && formData.year && !loadingSuggestion && availableCharges.length === 0 && (
                        <div className={`p-4 rounded-lg ${theme.bg.tertiary} border ${theme.border.primary}`}>
                            <div className="text-center">
                                <div className={`text-sm ${theme.text.secondary} mb-2`}>
                                    No unbilled charges found for {selectedParty?.name} in {formData.quarter} {formData.year}
                                </div>
                                <div className={`text-xs ${theme.text.muted}`}>
                                    You can still create a bill with a manual amount
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bill Amount */}
                    <div>
                        <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                            Bill Amount (₹) *
                        </label>
                        <input
                            type="text"
                            value={formData.amount}
                            onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
                            className={`
              w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
              ${errors.amount ? 'border-red-500' : theme.border.primary}
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            `}
                            placeholder="Enter bill amount"
                            disabled={loading}
                        />
                        {errors.amount && (
                            <p className="mt-1 text-sm text-red-500">{errors.amount}</p>
                        )}
                    </div>


                    {/* Split Bill Option */}
                    <div>
                        <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                            Split Bill in 3 Months?
                        </label>
                        <div className="flex space-x-4">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="isSplit"
                                    checked={formData.isSplit === true}
                                    onChange={() => handleFieldChange('isSplit', true as any)}
                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                />
                                <span className={`ml-2 text-sm ${theme.text.primary}`}>Yes</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="isSplit"
                                    checked={formData.isSplit === false}
                                    onChange={() => handleFieldChange('isSplit', false as any)}
                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                />
                                <span className={`ml-2 text-sm ${theme.text.primary}`}>No</span>
                            </label>
                        </div>
                        <p className={`mt-1 text-xs ${theme.text.muted}`}>
                            {formData.isSplit
                                ? "Bill will capture 'Warehousing Charges' split across 3 months of the quarter."
                                : "Bill will capture 'Extra Space' charges as a single line item."}
                        </p>
                    </div>

                    {/* Particulars (Editable) */}
                    <div>
                        <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                            Particulars
                        </label>
                        <textarea
                            value={formData.particulars}
                            onChange={(e) => handleFieldChange('particulars', e.target.value)}
                            rows={4}
                            className={`
                                w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
                                ${theme.border.primary} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            `}
                            placeholder="Enter bill particulars"
                            disabled={loading}
                        />
                        <p className={`mt-1 text-xs ${theme.text.muted}`}>
                            Customize the text that will appear in the specific 'Particulars' column of the PDF.
                        </p>
                    </div>

                    {/* Bill Date */}
                    <div>
                        <label className={`block text-sm font-medium ${theme.text.primary} mb-2`}>
                            Bill Date *
                        </label>
                        <input
                            type="date"
                            value={formData.billDate}
                            onChange={(e) => handleFieldChange('billDate', e.target.value)}
                            className={`
              w-full px-3 py-2 border rounded-lg ${theme.bg.primary} ${theme.text.primary}
              ${errors.billDate ? 'border-red-500' : theme.border.primary}
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            `}
                            disabled={loading}
                        />
                        {errors.billDate && (
                            <p className="mt-1 text-sm text-red-500">{errors.billDate}</p>
                        )}
                    </div>

                    {/* Receipt Date - Reverted */}



                </form>
            )
            }
        </Modal>
    );
};
export default BillModal;