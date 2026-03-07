import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Party } from '../../types';
import { emailApi } from '../../utils/api';
import Button from '../common/Button';

interface EmailReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportType: 'monthly';
    doNumber?: string;
    parties: Party[];
    preSelectedPartyId?: string;
}

const EmailReportModal: React.FC<EmailReportModalProps> = ({
    isOpen,
    onClose,
    reportType,
    parties,
    preSelectedPartyId
}) => {
    const [selectedPartyId, setSelectedPartyId] = useState(preSelectedPartyId || '');
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [sending, setSending] = useState(false);
    const [emailEnabled, setEmailEnabled] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(true);

    useEffect(() => {
        if (preSelectedPartyId) {
            setSelectedPartyId(preSelectedPartyId);
        }
    }, [preSelectedPartyId]);

    useEffect(() => {
        if (isOpen) {
            checkEmailStatus();
        }
    }, [isOpen]);

    const checkEmailStatus = async () => {
        setCheckingEmail(true);
        try {
            const configRes = await window.electron?.email?.getConfig?.();
            if (configRes?.ok && configRes.data) {
                setEmailEnabled(configRes.data.enabled);
            } else {
                setEmailEnabled(false);
            }
        } catch (error) {
            setEmailEnabled(false);
        } finally {
            setCheckingEmail(false);
        }
    };

    const handleSendReport = async () => {
        if (!selectedPartyId) {
            toast.error('Please select a party');
            return;
        }

        if (!emailEnabled) {
            toast.error('Email is not configured. Please configure email settings first.');
            return;
        }

        setSending(true);
        emailApi.sendMonthlyReport(month, year, selectedPartyId).then(
            (_) => {
                const selectedParty = parties.find(p => p._id === selectedPartyId);
                toast.success(`Report sent successfully to ${selectedParty?.name || 'selected party'}`);
                onClose();
            }
        ).catch((error: any) => {
            toast.error(error?.message || 'Failed to send report');
        }).finally(() => {
            setSending(false);
        });
    };

    const selectedParty = parties.find(p => p._id === selectedPartyId);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-theme-card border border-theme-primary rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-theme-primary">
                        Send Monthly Stock Report
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-theme-secondary hover:text-theme-primary"
                        disabled={sending}
                    >
                        ✕
                    </button>
                </div>

                {checkingEmail ? (
                    <div className="text-center py-4">
                        <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-sm text-theme-secondary">Checking email configuration...</p>
                    </div>
                ) : !emailEnabled ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                            <span className="text-sm font-medium text-yellow-400">Email Not Configured</span>
                        </div>
                        <p className="text-sm text-theme-secondary mb-3">
                            Email functionality is not configured or disabled. Please configure Gmail SMTP settings first.
                        </p>
                        <Button
                            onClick={() => {
                                onClose();
                                // Navigate to settings page - this would need to be implemented based on your routing
                                toast.error('Please go to Settings to configure email');
                            }}
                            className="text-sm px-3 py-1 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                        >
                            Go to Settings
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">

                        {reportType === 'monthly' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm text-theme-secondary mb-1">Month</label>
                                    <select
                                        value={month}
                                        onChange={(e) => setMonth(parseInt(e.target.value))}
                                        className="w-full p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary focus:outline-none focus:ring"
                                        disabled={sending}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <option key={i + 1} value={i + 1}>
                                                {new Date(0, i).toLocaleDateString('en-US', { month: 'long' })}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-theme-secondary mb-1">Year</label>
                                    <select
                                        value={year}
                                        onChange={(e) => setYear(parseInt(e.target.value))}
                                        className="w-full p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary focus:outline-none focus:ring"
                                        disabled={sending}
                                    >
                                        {Array.from({ length: 5 }, (_, i) => {
                                            const yearOption = new Date().getFullYear() - i;
                                            return (
                                                <option key={yearOption} value={yearOption}>
                                                    {yearOption}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm text-theme-secondary mb-1">Send to Party</label>
                            <select
                                value={selectedPartyId}
                                onChange={(e) => setSelectedPartyId(e.target.value)}
                                className="w-full p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary focus:outline-none focus:ring"
                                disabled={sending}
                            >
                                <option value="">Select a party...</option>
                                {parties.map((party) => (
                                    <option key={party._id} value={party._id}>
                                        {party.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedParty && (
                            <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                                <p className="text-sm text-theme-secondary">
                                    <strong>Recipient:</strong> {selectedParty.orgEmail || 'No email address'}
                                </p>
                                {!selectedParty.orgEmail && (
                                    <p className="text-xs text-red-400 mt-1">
                                        This party does not have an organization email address configured.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            <Button
                                onClick={onClose}
                                disabled={sending}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSendReport}
                                disabled={sending || !selectedPartyId || !selectedParty?.orgEmail}
                                className="flex-1 bg-brand-primary text-white hover:opacity-90 disabled:opacity-60"
                            >
                                {sending ? (
                                    <div className="flex items-center gap-2">
                                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        Sending...
                                    </div>
                                ) : (
                                    'Send Report'
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmailReportModal;