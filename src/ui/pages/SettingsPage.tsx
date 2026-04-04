import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import { useTheme } from '../hooks/useTheme';
import { dbApi } from '../utils/api';

const SettingsPage: React.FC = () => {
  const [statusLoading, setStatusLoading] = useState(true);
  const [hasSaved, setHasSaved] = useState<boolean>(false);
  const [uri, setUri] = useState('');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { theme } = useTheme();

  // Collections deletion state
  const [colLoading, setColLoading] = useState(false);
  const [collections, setCollections] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dropping, setDropping] = useState(false);
  // Export Collections state
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'ejson' | 'json' | 'csv'>('ejson');
  // Import Collections state
  const [importing, setImporting] = useState(false);

  // Encryption state
  const [encryptionLoading, setEncryptionLoading] = useState(true);
  const [hasEncryptionKey, setHasEncryptionKey] = useState<boolean>(false);
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Email state
  const [emailLoading, setEmailLoading] = useState(true);
  const [hasEmailConfig, setHasEmailConfig] = useState<boolean>(false);
  const [emailEnabled, setEmailEnabled] = useState<boolean>(false);
  const [gmailAddress, setGmailAddress] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [confirmAppPassword, setConfirmAppPassword] = useState('');
  const [settingEmail, setSettingEmail] = useState(false);
  const [clearingEmail, setClearingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [settingKey, setSettingKey] = useState(false);
  const [clearingKey, setClearingKey] = useState(false);
  const [keyMetadata, setKeyMetadata] = useState<{
    createdAt: Date;
    lastRotated: Date;
    version: number;
    isRotationRecommended: boolean;
  } | null>(null);
  const [showRotationDialog, setShowRotationDialog] = useState(false);
  const [newRotationPassword, setNewRotationPassword] = useState('');
  const [confirmRotationPassword, setConfirmRotationPassword] = useState('');
  const [rotatingKey, setRotatingKey] = useState(false);

  // Migration progress state
  const [migrationProgress, setMigrationProgress] = useState<{
    totalRecords: number;
    processedRecords: number;
    failedRecords: number;
    currentCollection: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    startTime: Date;
    endTime?: Date;
    errors: Array<{
      recordId: string;
      collection: string;
      field: string;
      error: string;
      timestamp: Date;
    }>;
  } | null>(null);
  const [showMigrationProgress, setShowMigrationProgress] = useState(false);

  // Decryption progress state for clearing encryption
  const [decryptionProgress, setDecryptionProgress] = useState<{
    totalRecords: number;
    processedRecords: number;
    failedRecords: number;
    currentCollection: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    startTime: Date;
    endTime?: Date;
    errors: Array<{
      recordId: string;
      collection: string;
      field: string;
      error: string;
      timestamp: Date;
    }>;
  } | null>(null);
  const [showDecryptionProgress, setShowDecryptionProgress] = useState(false);

  // Auto Backup Sync state
  const [backupLoading, setBackupLoading] = useState(true);
  const [hasBackupConfig, setHasBackupConfig] = useState(false);
  const [backupFreq, setBackupFreq] = useState('never');
  const [backupDir, setBackupDir] = useState('');
  const [settingBackup, setSettingBackup] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [backupLastRunAt, setBackupLastRunAt] = useState<string | null>(null);
  const [backupLastSuccessAt, setBackupLastSuccessAt] = useState<string | null>(null);
  const [backupLastError, setBackupLastError] = useState<string | null>(null);
  const [backupLastPath, setBackupLastPath] = useState<string | null>(null);

  const selectedNames = useMemo(() => Object.keys(selected).filter(k => selected[k]), [selected]);

  const loadCollections = async () => {
    setColLoading(true);
    try {
      const res = await dbApi.listCollections();
      setCollections(res.data || []);
      setSelected({});
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load collections');
    } finally {
      setColLoading(false);
    }
  };

  const handleImportCollections = async () => {
    setImporting(true);
    try {
      const res = await dbApi.importCollections();
      const data = res.data as any;
      const imported = data?.imported?.length || 0;
      const skipped = data?.skipped?.length || 0;
      const failed = data?.failed?.length || 0;
      toast.success(`Import finished. Imported: ${imported}, Skipped: ${skipped}, Failed: ${failed}`);
      if (failed > 0) {
        console.warn('Import failures:', data.failed);
      }
      // reload collections list to reflect new ones
      await loadCollections();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to import collections');
    } finally {
      setImporting(false);
    }
  };

  const handleExportCollections = async () => {
    if (selectedNames.length === 0) {
      toast.error('Select at least one collection');
      return;
    }
    setExporting(true);
    try {
      const res = await dbApi.exportCollections(selectedNames, exportFormat);
      toast.success(`Exported to: ${(res.data as any)?.savedTo || 'ZIP saved'}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to export collections');
    } finally {
      setExporting(false);
    }
  };

  const handleToggle = (name: string) => {
    setSelected(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleToggleAll = () => {
    const allSelected = selectedNames.length === collections.length && collections.length > 0;
    if (allSelected) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      for (const c of collections) next[c] = true;
      setSelected(next);
    }
  };

  const handleDropCollections = async () => {
    if (selectedNames.length === 0) {
      toast.error('Select at least one collection');
      return;
    }
    // Safety confirm
    const sure = window.confirm(`Are you sure you want to drop ${selectedNames.length} collection(s)? This cannot be undone.`);
    if (!sure) return;
    setDropping(true);
    try {
      const res = await dbApi.dropCollections(selectedNames);
      const { dropped = [], failed = [] } = res.data || ({} as any);
      if (dropped.length > 0) { toast.success(`Dropped ${dropped.length} collection(s)`); window.location.reload(); }
      if (failed.length > 0) toast.error(`Failed: ${failed.map(f => f.name).join(', ')}`);
      await loadCollections();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to drop collections');
    } finally {
      setDropping(false);
    }
  };

  // Encryption functions
  const loadEncryptionStatus = async () => {
    setEncryptionLoading(true);
    try {
      const hasKeyRes = await window.electron?.encryption?.hasKey?.();
      if (hasKeyRes?.ok) {
        setHasEncryptionKey(Boolean(hasKeyRes.data));

        if (hasKeyRes.data) {
          const metadataRes = await window.electron?.encryption?.getMetadata?.();
          if (metadataRes?.ok && metadataRes.data) {
            setKeyMetadata(metadataRes.data);
          }
        }
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load encryption status');
    } finally {
      setEncryptionLoading(false);
    }
  };

  const validatePasswordStrength = (password: string): { isValid: boolean; message: string } => {
    if (password.length < 12) {
      return { isValid: false, message: 'Password must be at least 12 characters long' };
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/(?=.*\d)/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one number' };
    }
    if (!/(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one special character' };
    }
    return { isValid: true, message: 'Strong password' };
  };

  const handleSetEncryptionKey = async () => {
    if (!encryptionPassword.trim()) {
      toast.error('Please enter an encryption password');
      return;
    }

    if (encryptionPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    const validation = validatePasswordStrength(encryptionPassword);
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }

    setSettingKey(true);
    try {
      const res = await window.electron?.encryption?.setKey?.(encryptionPassword);
      if (res?.ok) {
        toast.success('Encryption key set successfully');
        setEncryptionPassword('');
        setConfirmPassword('');
        await loadEncryptionStatus();
      } else {
        toast.error(res?.error || 'Failed to set encryption key');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to set encryption key');
    } finally {
      setSettingKey(false);
    }
  };

  const handleClearEncryptionKey = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to disable encryption? This will decrypt all encrypted data and store it as plain text, then remove the encryption key.'
    );
    if (!confirmed) return;

    setClearingKey(true);
    setShowDecryptionProgress(true);
    setDecryptionProgress({
      totalRecords: 0,
      processedRecords: 0,
      failedRecords: 0,
      currentCollection: 'Initializing...',
      status: 'running',
      startTime: new Date(),
      errors: []
    });

    try {
      // Set up progress listener
      const handleProgress = (progress: any) => {
        setDecryptionProgress(progress);
      };

      // Add event listener for progress updates
      window.electron?.encryption?.onDecryptionProgress?.(handleProgress);

      const res = await window.electron?.encryption?.clearKey?.();

      if (res?.ok) {
        toast.success('Encryption disabled and data decrypted successfully');
        setShowDecryptionProgress(false);
        setDecryptionProgress(null);
        await loadEncryptionStatus();
      } else {
        toast.error(res?.error || 'Failed to disable encryption');
        setDecryptionProgress(prev => prev ? { ...prev, status: 'failed' } : null);
      }

      // Clean up event listener
      window.electron?.encryption?.offDecryptionProgress?.();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to disable encryption');
      setDecryptionProgress(prev => prev ? { ...prev, status: 'failed' } : null);
      window.electron?.encryption?.offDecryptionProgress?.();
    } finally {
      setClearingKey(false);
    }
  };

  const handleCancelDecryption = async () => {
    try {
      const res = await window.electron?.encryption?.cancelDecryption?.();
      if (res?.ok) {
        toast.success('Decryption cancelled');
        setDecryptionProgress(prev => prev ? { ...prev, status: 'cancelled' } : null);
      } else {
        toast.error(res?.error || 'Failed to cancel decryption');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to cancel decryption');
    }
  };

  const closeDecryptionProgress = () => {
    if (decryptionProgress?.status === 'running') {
      const confirmed = window.confirm(
        'Decryption is still in progress. Are you sure you want to close this dialog? The decryption will continue in the background.'
      );
      if (!confirmed) return;
    }
    setShowDecryptionProgress(false);
    if (decryptionProgress?.status !== 'running') {
      setDecryptionProgress(null);
    }
  };

  const handleRotateKey = async () => {
    if (!newRotationPassword.trim()) {
      toast.error('Please enter a new encryption password');
      return;
    }

    if (newRotationPassword !== confirmRotationPassword) {
      toast.error('Passwords do not match');
      return;
    }

    const validation = validatePasswordStrength(newRotationPassword);
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }

    setRotatingKey(true);
    setShowMigrationProgress(true);
    setMigrationProgress({
      totalRecords: 0,
      processedRecords: 0,
      failedRecords: 0,
      currentCollection: 'Initializing...',
      status: 'running',
      startTime: new Date(),
      errors: []
    });

    try {
      // Set up progress listener
      const handleProgress = (progress: any) => {
        setMigrationProgress(progress);
      };

      // Add event listener for progress updates
      window.electron?.encryption?.onMigrationProgress?.(handleProgress);

      const res = await window.electron?.encryption?.rotateKeyWithMigration?.(newRotationPassword);

      if (res?.ok) {
        toast.success('Encryption key rotated and data migrated successfully');
        setNewRotationPassword('');
        setConfirmRotationPassword('');
        setShowRotationDialog(false);
        setShowMigrationProgress(false);
        setMigrationProgress(null);
        await loadEncryptionStatus();
      } else {
        toast.error(res?.error || 'Failed to rotate encryption key');
        setMigrationProgress(prev => prev ? { ...prev, status: 'failed' } : null);
      }

      // Clean up event listener
      window.electron?.encryption?.offMigrationProgress?.();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to rotate encryption key');
      setMigrationProgress(prev => prev ? { ...prev, status: 'failed' } : null);
      window.electron?.encryption?.offMigrationProgress?.();
    } finally {
      setRotatingKey(false);
    }
  };

  const handleCancelMigration = async () => {
    try {
      const res = await window.electron?.encryption?.cancelMigration?.();
      if (res?.ok) {
        toast.success('Migration cancelled');
        setMigrationProgress(prev => prev ? { ...prev, status: 'cancelled' } : null);
      } else {
        toast.error(res?.error || 'Failed to cancel migration');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to cancel migration');
    }
  };

  const handleRollbackMigration = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to rollback the migration? This will restore the original encrypted data.'
    );
    if (!confirmed) return;

    try {
      const res = await window.electron?.encryption?.rollbackMigration?.();
      if (res?.ok) {
        toast.success('Migration rolled back successfully');
        setShowMigrationProgress(false);
        setMigrationProgress(null);
      } else {
        toast.error(res?.error || 'Failed to rollback migration');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to rollback migration');
    }
  };

  const closeMigrationProgress = () => {
    if (migrationProgress?.status === 'running') {
      const confirmed = window.confirm(
        'Migration is still in progress. Are you sure you want to close this dialog? The migration will continue in the background.'
      );
      if (!confirmed) return;
    }
    setShowMigrationProgress(false);
    if (migrationProgress?.status !== 'running') {
      setMigrationProgress(null);
    }
  };

  const cancelRotation = () => {
    setShowRotationDialog(false);
    setNewRotationPassword('');
    setConfirmRotationPassword('');
  };

  // Email functions
  const loadEmailStatus = async () => {
    setEmailLoading(true);
    try {
      const hasConfigRes = await window.electron?.email?.hasConfig?.();
      if (hasConfigRes?.ok) {
        setHasEmailConfig(Boolean(hasConfigRes.data));

        if (hasConfigRes.data) {
          const configRes = await window.electron?.email?.getConfig?.();
          if (configRes?.ok && configRes.data) {
            setGmailAddress(configRes.data.gmailAddress);
            setEmailEnabled(configRes.data.enabled);
          }
        }
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load email status');
    } finally {
      setEmailLoading(false);
    }
  };

  const validateEmailConfig = (gmailAddr: string, appPass: string): { isValid: boolean; message: string } => {
    if (!gmailAddr.trim()) {
      return { isValid: false, message: 'Gmail address is required' };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!emailRegex.test(gmailAddr)) {
      return { isValid: false, message: 'Please enter a valid Gmail address' };
    }

    if (!appPass.trim()) {
      return { isValid: false, message: 'App password is required' };
    }

    const appPasswordRegex = /^[a-zA-Z0-9]{16}$/;
    if (!appPasswordRegex.test(appPass)) {
      return { isValid: false, message: 'App password must be 16 characters (letters and numbers only)' };
    }

    return { isValid: true, message: 'Valid configuration' };
  };

  const handleSetEmailConfig = async () => {
    if (!gmailAddress.trim() || !appPassword.trim()) {
      toast.error('Please enter Gmail address and app password');
      return;
    }

    if (appPassword !== confirmAppPassword) {
      toast.error('App passwords do not match');
      return;
    }

    const validation = validateEmailConfig(gmailAddress, appPassword);
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }

    setSettingEmail(true);
    try {
      const res = await window.electron?.email?.setConfig?.({
        gmailAddress: gmailAddress.trim(),
        appPassword: appPassword.trim(),
        enabled: emailEnabled
      });

      if (res?.ok) {
        toast.success('Email configuration saved successfully');
        setAppPassword('');
        setConfirmAppPassword('');
        await loadEmailStatus();
      } else {
        toast.error(res?.error || 'Failed to save email configuration');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save email configuration');
    } finally {
      setSettingEmail(false);
    }
  };

  const handleTestEmailConfig = async () => {
    if (!gmailAddress.trim() || !appPassword.trim()) {
      toast.error('Please enter Gmail address and app password');
      return;
    }

    const validation = validateEmailConfig(gmailAddress, appPassword);
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }

    setTestingEmail(true);
    try {
      const res = await window.electron?.email?.testConfig?.({
        gmailAddress: gmailAddress.trim(),
        appPassword: appPassword.trim(),
        enabled: true
      });

      if (res?.ok && res.data) {
        toast.success('Email configuration test successful!');
      } else {
        toast.error('Email configuration test failed. Please check your credentials.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to test email configuration');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleClearEmailConfig = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear the email configuration? This will disable email functionality.'
    );
    if (!confirmed) return;

    setClearingEmail(true);
    try {
      const res = await window.electron?.email?.clearConfig?.();
      if (res?.ok) {
        toast.success('Email configuration cleared');
        setGmailAddress('');
        setAppPassword('');
        setConfirmAppPassword('');
        setEmailEnabled(false);
        await loadEmailStatus();
      } else {
        toast.error(res?.error || 'Failed to clear email configuration');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to clear email configuration');
    } finally {
      setClearingEmail(false);
    }
  };

  const handleToggleEmail = async (enabled: boolean) => {
    try {
      const res = await window.electron?.email?.setEnabled?.(enabled);
      if (res?.ok) {
        setEmailEnabled(enabled);
        toast.success(`Email functionality ${enabled ? 'enabled' : 'disabled'}`);
      } else {
        toast.error(res?.error || 'Failed to update email status');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update email status');
    }
  };

  const loadBackupStatus = async () => {
    setBackupLoading(true);
    try {
      const res = await window.electron?.autobackup?.getConfig?.();
      if (res?.ok && res.data) {
         setHasBackupConfig(true);
         setBackupFreq(res.data.frequency || 'never');
         setBackupDir(res.data.directory || '');
         setBackupLastRunAt(res.data.lastRunAt || null);
         setBackupLastSuccessAt(res.data.lastSuccessAt || null);
         setBackupLastError(res.data.lastError || null);
         setBackupLastPath(res.data.lastBackupPath || null);
      } else {
         setHasBackupConfig(false);
         setBackupLastRunAt(null);
         setBackupLastSuccessAt(null);
         setBackupLastError(null);
         setBackupLastPath(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSelectBackupDir = async () => {
      try {
          const res = await window.electron?.autobackup?.selectDirectory?.();
          if(res?.ok && res.data) {
             setBackupDir(res.data);
          }
      } catch(e: any) { toast.error(e?.message); }
  };

  const handleSetBackupConfig = async () => {
     if (backupFreq !== 'never' && !backupDir.trim()) {
        toast.error('Directory is required to enable backup.');
        return;
     }
     setSettingBackup(true);
     try {
       const res = await window.electron?.autobackup?.setConfig?.({
          directory: backupDir.trim(),
          frequency: backupFreq
       });
       if(res?.ok) {
          toast.success(backupFreq === 'never'
            ? 'Backup configuration saved. Automatic backups are disabled.'
            : 'Backup configuration saved. Automatic backups will run only while the app is open.');
          await loadBackupStatus();
       } else {
          toast.error(res?.error || 'Failed to save configuration');
       }
     } catch (e: any) {
       toast.error(e?.message || 'Failed to save configuration');
     } finally {
       setSettingBackup(false);
     }
  };

  const handleRunBackupNow = async () => {
    if (!hasBackupConfig || !backupDir.trim()) {
      toast.error('Save a backup directory first.');
      return;
    }
    setRunningBackup(true);
    try {
      const res = await window.electron?.autobackup?.triggerBackup?.();
      if (res?.ok && res.data) {
        toast.success(`Backup created: ${res.data}`);
        await loadBackupStatus();
      } else {
        toast.error(res?.error || 'Backup failed');
        await loadBackupStatus();
      }
    } catch (e: any) {
      toast.error(e?.message || 'Backup failed');
      await loadBackupStatus();
    } finally {
      setRunningBackup(false);
    }
  };

  const formatBackupTime = (value: string | null) => {
    if (!value) return 'Never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const res = await window.electron?.secure?.hasMongoUri?.();
        if (!mounted) return;
        setHasSaved(Boolean(res?.ok && res.data));
      } catch {
        setHasSaved(false);
      } finally {
        setStatusLoading(false);
      }
    }
    check();
    loadEncryptionStatus();
    loadEmailStatus();
    loadBackupStatus();
    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    if (!uri.trim()) {
      toast.error('Please enter a valid MongoDB connection URI');
      return;
    }
    setSaving(true);
    const res = await window.electron?.secure?.setMongoUri?.(uri.trim());
    setSaving(false);
    if (res?.ok) {
      toast.success('MongoDB URI saved');
      setHasSaved(true);
      window.location.reload();
    } else {
      toast.error(res?.error || 'Failed to save');
    }
  };

  const handleClear = async () => {
    setClearing(true);
    const res = await window.electron?.secure?.clearMongoUri?.();
    setClearing(false);
    if (res?.ok) {
      toast.success('MongoDB URI cleared');
      window.location.reload();
    } else {
      toast.error(res?.error || 'Failed to clear');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className={`text-2xl font-semibold ${theme.text.primary} mb-2`}>Settings</h1>
      <p className="text-theme-secondary mb-8">Configure application settings.</p>

      <div className="bg-theme-card border border-theme-primary rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Database Connection</h2>
            <p className="text-sm text-theme-secondary">Manage your MongoDB connection URI secured by the system keychain.</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${hasSaved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
            {statusLoading ? 'Checking…' : hasSaved ? 'Configured' : 'Not Configured'}
          </span>
        </div>

        <div className="grid gap-2">
          <label className="text-sm text-theme-secondary">MongoDB URI</label>
          <input
            type="text"
            value={uri}
            onChange={e => setUri(e.target.value)}
            placeholder="e.g. mongodb://localhost:27017/warehouse"
            className="w-full p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary focus:outline-none focus:ring"
          />
          <div className="flex items-center gap-2">
            <Button
              className="px-4 py-2 rounded bg-brand-primary text-white hover:opacity-90 disabled:opacity-60"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save URI'}
            </Button>
            <Button
              onClick={() => setUri('')}
              disabled={saving || clearing}
            >
              Clear Input
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t border-theme-primary">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Stored URI</p>
              <p className="text-sm text-theme-secondary">For security, credentials are masked and the full URI is not displayed.</p>
            </div>
            <Button
              className="px-4 py-2 rounded bg-red-500/80 text-white hover:bg-red-500 disabled:opacity-60"
              onClick={handleClear}
              disabled={clearing || statusLoading || !hasSaved}
            >
              {clearing ? 'Deleting…' : 'Delete Stored URI'}
            </Button>
          </div>
        </div>

        <div className="text-xs text-theme-secondary">
          Tip: After saving or deleting, the app will use the new setting immediately. A restart is not required.
        </div>
      </div>

      {/* Encryption Settings Card */}
      <div className="bg-theme-card border border-theme-primary rounded-lg p-6 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Field Encryption</h2>
            <p className="text-sm text-theme-secondary">Configure encryption for sensitive data fields like names, addresses, and contact information.</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${hasEncryptionKey ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
            {encryptionLoading ? 'Checking…' : hasEncryptionKey ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {!hasEncryptionKey ? (
          <div className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm text-theme-secondary">Encryption Password</label>
              <input
                type="password"
                value={encryptionPassword}
                onChange={e => setEncryptionPassword(e.target.value)}
                placeholder="Enter a strong password (min 12 characters)"
                className="w-full p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary focus:outline-none focus:ring"
              />
              <div className="text-xs text-theme-secondary">
                Password must contain: 12+ characters, uppercase, lowercase, number, and special character
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-theme-secondary">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="w-full p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary focus:outline-none focus:ring"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                className="px-4 py-2 rounded bg-brand-primary text-white hover:opacity-90 disabled:opacity-60"
                onClick={handleSetEncryptionKey}
                disabled={settingKey || !encryptionPassword || !confirmPassword}
              >
                {settingKey ? 'Setting Key…' : 'Enable Encryption'}
              </Button>
              <Button
                onClick={() => {
                  setEncryptionPassword('');
                  setConfirmPassword('');
                }}
                disabled={settingKey}
              >
                Clear Fields
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm font-medium text-green-400">Encryption Active</span>
              </div>
              <p className="text-sm text-theme-secondary">
                Field encryption is enabled. Sensitive data fields are automatically encrypted when saved.
              </p>
              {keyMetadata && (
                <div className="mt-2 text-xs text-theme-secondary">
                  <div>Key created: {new Date(keyMetadata.createdAt).toLocaleDateString()}</div>
                  <div>Last rotated: {new Date(keyMetadata.lastRotated).toLocaleDateString()}</div>
                  {keyMetadata.isRotationRecommended && (
                    <div className="text-yellow-400 mt-1">⚠️ Key rotation recommended (6+ months old)</div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-theme-primary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Key Rotation</p>
                  <p className="text-sm text-theme-secondary">Rotate your encryption key for enhanced security. Recommended every 6 months.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    className={`px-4 py-2 rounded ${keyMetadata?.isRotationRecommended ? 'bg-yellow-500/80 text-white hover:bg-yellow-500' : 'bg-blue-500/80 text-white hover:bg-blue-500'} disabled:opacity-60`}
                    onClick={() => setShowRotationDialog(true)}
                    disabled={rotatingKey || showRotationDialog}
                  >
                    {keyMetadata?.isRotationRecommended ? '⚠️ Rotate Key (Recommended)' : 'Rotate Key'}
                  </Button>
                </div>
              </div>
            </div>

            {showRotationDialog && !showMigrationProgress && (
              <div className="pt-4 border-t border-theme-primary">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span className="text-sm font-medium text-blue-400">Key Rotation with Data Migration</span>
                  </div>

                  <div className="text-sm text-theme-secondary mb-4">
                    This will rotate your encryption key and re-encrypt all existing encrypted data. The process may take some time for large datasets and includes progress tracking with rollback capability.
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm text-theme-secondary">New Encryption Password</label>
                    <input
                      type="password"
                      value={newRotationPassword}
                      onChange={e => setNewRotationPassword(e.target.value)}
                      placeholder="Enter new strong password"
                      className="w-full p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary focus:outline-none focus:ring"
                      disabled={rotatingKey}
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm text-theme-secondary">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmRotationPassword}
                      onChange={e => setConfirmRotationPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary focus:outline-none focus:ring"
                      disabled={rotatingKey}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      className="px-4 py-2 rounded bg-blue-500/80 text-white hover:bg-blue-500 disabled:opacity-60"
                      onClick={handleRotateKey}
                      disabled={rotatingKey || !newRotationPassword || !confirmRotationPassword}
                    >
                      {rotatingKey ? 'Starting Migration…' : 'Start Key Rotation & Migration'}
                    </Button>
                    <Button
                      onClick={cancelRotation}
                      disabled={rotatingKey}
                    >
                      Cancel
                    </Button>
                  </div>

                  <div className="text-xs text-theme-secondary bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
                    <strong>Important:</strong> This process will migrate all encrypted data. You can monitor progress, cancel if needed, or rollback if issues occur.
                  </div>
                </div>
              </div>
            )}

            {showMigrationProgress && migrationProgress && (
              <div className="pt-4 border-t border-theme-primary">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-4 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${migrationProgress.status === 'running' ? 'bg-blue-400' :
                        migrationProgress.status === 'completed' ? 'bg-green-400' :
                          migrationProgress.status === 'failed' ? 'bg-red-400' :
                            'bg-yellow-400'
                        }`}></div>
                      <span className="text-sm font-medium text-blue-400">
                        {migrationProgress.status === 'running' ? 'Migration in Progress' :
                          migrationProgress.status === 'completed' ? 'Migration Completed' :
                            migrationProgress.status === 'failed' ? 'Migration Failed' :
                              'Migration Cancelled'}
                      </span>
                    </div>
                    <Button
                      onClick={closeMigrationProgress}
                      className="text-xs px-2 py-1"
                      disabled={migrationProgress.status === 'running'}
                    >
                      ✕
                    </Button>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-theme-secondary">
                      <span>Progress: {migrationProgress.processedRecords} / {migrationProgress.totalRecords}</span>
                      <span>{migrationProgress.totalRecords > 0 ? Math.round((migrationProgress.processedRecords / migrationProgress.totalRecords) * 100) : 0}%</span>
                    </div>
                    <div className="w-full bg-theme-primary rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${migrationProgress.status === 'completed' ? 'bg-green-400' :
                          migrationProgress.status === 'failed' ? 'bg-red-400' :
                            migrationProgress.status === 'cancelled' ? 'bg-yellow-400' :
                              'bg-blue-400'
                          }`}
                        style={{
                          width: `${migrationProgress.totalRecords > 0 ? (migrationProgress.processedRecords / migrationProgress.totalRecords) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Current Status */}
                  <div className="text-sm text-theme-secondary">
                    <div>Current Collection: <span className="font-mono">{migrationProgress.currentCollection}</span></div>
                    <div>Started: {new Date(migrationProgress.startTime).toLocaleString()}</div>
                    {migrationProgress.endTime && (
                      <div>Completed: {new Date(migrationProgress.endTime).toLocaleString()}</div>
                    )}
                    {migrationProgress.failedRecords > 0 && (
                      <div className="text-red-400">Failed Records: {migrationProgress.failedRecords}</div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    {migrationProgress.status === 'running' && (
                      <Button
                        className="px-4 py-2 rounded bg-yellow-500/80 text-white hover:bg-yellow-500"
                        onClick={handleCancelMigration}
                      >
                        Cancel Migration
                      </Button>
                    )}

                    {(migrationProgress.status === 'failed' || migrationProgress.status === 'cancelled') && (
                      <Button
                        className="px-4 py-2 rounded bg-red-500/80 text-white hover:bg-red-500"
                        onClick={handleRollbackMigration}
                      >
                        Rollback Changes
                      </Button>
                    )}

                    {migrationProgress.status === 'completed' && (
                      <div className="flex items-center gap-2 text-green-400 text-sm">
                        <div className="w-4 h-4 rounded-full bg-green-400 flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                        <span>Key rotation and data migration completed successfully!</span>
                      </div>
                    )}
                  </div>

                  {/* Error Details */}
                  {migrationProgress.errors.length > 0 && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded">
                      <div className="text-sm font-medium text-red-400 mb-2">
                        Migration Errors ({migrationProgress.errors.length})
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {migrationProgress.errors.slice(0, 5).map((error, index) => (
                          <div key={index} className="text-xs text-theme-secondary">
                            <span className="font-mono">{error.collection}</span> -
                            <span className="font-mono">{error.field}</span>: {error.error}
                          </div>
                        ))}
                        {migrationProgress.errors.length > 5 && (
                          <div className="text-xs text-theme-secondary">
                            ... and {migrationProgress.errors.length - 5} more errors
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {migrationProgress.status === 'running' && (
                    <div className="flex items-center gap-2 text-sm text-theme-secondary">
                      <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                      <span>Migrating encrypted data with new key...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-theme-primary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Disable Encryption</p>
                  <p className="text-sm text-theme-secondary">Decrypt all encrypted data and disable encryption. Data will be stored as plain text.</p>
                </div>
                <Button
                  className="px-4 py-2 rounded bg-red-500/80 text-white hover:bg-red-500 disabled:opacity-60"
                  onClick={handleClearEncryptionKey}
                  disabled={clearingKey || showRotationDialog || showDecryptionProgress}
                >
                  {clearingKey ? 'Decrypting Data…' : 'Disable Encryption'}
                </Button>
              </div>
            </div>

            {showDecryptionProgress && decryptionProgress && (
              <div className="pt-4 border-t border-theme-primary">
                <div className="bg-red-500/10 border border-red-500/20 rounded p-4 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${decryptionProgress.status === 'running' ? 'bg-blue-400' :
                        decryptionProgress.status === 'completed' ? 'bg-green-400' :
                          decryptionProgress.status === 'failed' ? 'bg-red-400' :
                            'bg-yellow-400'
                        }`}></div>
                      <span className="text-sm font-medium text-red-400">
                        {decryptionProgress.status === 'running' ? 'Decrypting Data' :
                          decryptionProgress.status === 'completed' ? 'Decryption Completed' :
                            decryptionProgress.status === 'failed' ? 'Decryption Failed' :
                              'Decryption Cancelled'}
                      </span>
                    </div>
                    <Button
                      onClick={closeDecryptionProgress}
                      className="text-xs px-2 py-1"
                      disabled={decryptionProgress.status === 'running'}
                    >
                      ✕
                    </Button>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-theme-secondary">
                      <span>Progress: {decryptionProgress.processedRecords} / {decryptionProgress.totalRecords}</span>
                      <span>{decryptionProgress.totalRecords > 0 ? Math.round((decryptionProgress.processedRecords / decryptionProgress.totalRecords) * 100) : 0}%</span>
                    </div>
                    <div className="w-full bg-theme-primary rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${decryptionProgress.status === 'completed' ? 'bg-green-400' :
                          decryptionProgress.status === 'failed' ? 'bg-red-400' :
                            decryptionProgress.status === 'cancelled' ? 'bg-yellow-400' :
                              'bg-blue-400'
                          }`}
                        style={{
                          width: `${decryptionProgress.totalRecords > 0 ? (decryptionProgress.processedRecords / decryptionProgress.totalRecords) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Current Status */}
                  <div className="text-sm text-theme-secondary">
                    <div>Current Collection: <span className="font-mono">{decryptionProgress.currentCollection}</span></div>
                    <div>Started: {new Date(decryptionProgress.startTime).toLocaleString()}</div>
                    {decryptionProgress.endTime && (
                      <div>Completed: {new Date(decryptionProgress.endTime).toLocaleString()}</div>
                    )}
                    {decryptionProgress.failedRecords > 0 && (
                      <div className="text-red-400">Failed Records: {decryptionProgress.failedRecords}</div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    {decryptionProgress.status === 'running' && (
                      <Button
                        className="px-4 py-2 rounded bg-yellow-500/80 text-white hover:bg-yellow-500"
                        onClick={handleCancelDecryption}
                      >
                        Cancel Decryption
                      </Button>
                    )}

                    {decryptionProgress.status === 'completed' && (
                      <div className="flex items-center gap-2 text-green-400 text-sm">
                        <div className="w-4 h-4 rounded-full bg-green-400 flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                        <span>All encrypted data has been decrypted and encryption disabled!</span>
                      </div>
                    )}

                    {(decryptionProgress.status === 'failed' || decryptionProgress.status === 'cancelled') && (
                      <div className="text-red-400 text-sm">
                        Decryption {decryptionProgress.status}. Encryption key was not cleared.
                      </div>
                    )}
                  </div>

                  {/* Error Details */}
                  {decryptionProgress.errors.length > 0 && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded">
                      <div className="text-sm font-medium text-red-400 mb-2">
                        Decryption Errors ({decryptionProgress.errors.length})
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {decryptionProgress.errors.slice(0, 5).map((error, index) => (
                          <div key={index} className="text-xs text-theme-secondary">
                            <span className="font-mono">{error.collection}</span> -
                            <span className="font-mono">{error.field}</span>: {error.error}
                          </div>
                        ))}
                        {decryptionProgress.errors.length > 5 && (
                          <div className="text-xs text-theme-secondary">
                            ... and {decryptionProgress.errors.length - 5} more errors
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {decryptionProgress.status === 'running' && (
                    <div className="flex items-center gap-2 text-sm text-theme-secondary">
                      <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                      <span>Decrypting all encrypted data to plain text...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-theme-secondary">
          Note: Encryption keys are stored securely in your system keychain. Encrypted fields include names, addresses, contact numbers, and tax IDs.
        </div>
      </div>

      {/* Email Settings Card */}
      <div className="bg-theme-card border border-theme-primary rounded-lg p-6 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Email Reports</h2>
            <p className="text-sm text-theme-secondary">Configure Gmail SMTP settings to send daily outward reports and monthly stock reports to parties.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${hasEmailConfig && emailEnabled ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {emailLoading ? 'Checking…' : hasEmailConfig && emailEnabled ? 'Enabled' : 'Disabled'}
            </span>
            {hasEmailConfig && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => handleToggleEmail(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Enable</span>
              </label>
            )}
          </div>
        </div>

        {!hasEmailConfig ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-sm font-medium text-blue-400">Gmail Setup Required</span>
              </div>
              <p className="text-sm text-theme-secondary mb-2">
                To send email reports, you need to configure Gmail SMTP with an App Password.
              </p>
              <p className="text-xs text-theme-secondary">
                1. Go to your Google Account settings<br />
                2. Enable 2-Step Verification<br />
                3. Generate an App Password for "Mail"<br />
                4. Use that 16-character password below
              </p>
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-theme-secondary">Gmail Address</label>
              <input
                type="email"
                value={gmailAddress}
                onChange={e => setGmailAddress(e.target.value)}
                placeholder="your-email@gmail.com"
                className="w-full p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary focus:outline-none focus:ring"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-theme-secondary">Gmail App Password</label>
              <input
                type="password"
                value={appPassword}
                onChange={e => setAppPassword(e.target.value)}
                placeholder="16-character app password"
                className="w-full p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary focus:outline-none focus:ring"
              />
              <div className="text-xs text-theme-secondary">
                App password must be exactly 16 characters (letters and numbers only)
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-theme-secondary">Confirm App Password</label>
              <input
                type="password"
                value={confirmAppPassword}
                onChange={e => setConfirmAppPassword(e.target.value)}
                placeholder="Confirm app password"
                className="w-full p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary focus:outline-none focus:ring"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                className="px-4 py-2 rounded bg-blue-500/80 text-white hover:bg-blue-500 disabled:opacity-60"
                onClick={handleTestEmailConfig}
                disabled={testingEmail || !gmailAddress || !appPassword}
              >
                {testingEmail ? 'Testing…' : 'Test Connection'}
              </Button>
              <Button
                className="px-4 py-2 rounded bg-brand-primary text-white hover:opacity-90 disabled:opacity-60"
                onClick={handleSetEmailConfig}
                disabled={settingEmail || !gmailAddress || !appPassword || !confirmAppPassword}
              >
                {settingEmail ? 'Saving…' : 'Save Configuration'}
              </Button>
              <Button
                onClick={() => {
                  setGmailAddress('');
                  setAppPassword('');
                  setConfirmAppPassword('');
                }}
                disabled={settingEmail}
              >
                Clear Fields
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm font-medium text-green-400">Email Configuration Active</span>
              </div>
              <p className="text-sm text-theme-secondary">
                Gmail SMTP is configured for <strong>{gmailAddress}</strong>. You can now send email reports to parties.
              </p>
            </div>

            <div className="pt-4 border-t border-theme-primary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Configuration</p>
                  <p className="text-sm text-theme-secondary">Update Gmail credentials or clear the configuration.</p>
                </div>
                <Button
                  className="px-4 py-2 rounded bg-red-500/80 text-white hover:bg-red-500 disabled:opacity-60"
                  onClick={handleClearEmailConfig}
                  disabled={clearingEmail}
                >
                  {clearingEmail ? 'Clearing…' : 'Clear Configuration'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-theme-secondary">
          Note: Gmail credentials are stored securely in your system keychain. Email reports are sent to parties' organization email addresses.
        </div>
      </div>

      {/* Local Auto Backup Configuration Card */}
      <div className="bg-theme-card border border-theme-primary rounded-lg p-6 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Auto-Backup to Local File System</h2>
            <p className="text-sm text-theme-secondary">Configure local backups for this device. Automatic backups run only while the app is open.</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${hasBackupConfig && backupFreq !== 'never' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
            {backupLoading ? 'Checking…' : (hasBackupConfig && backupFreq !== 'never') ? 'Active' : 'Disabled'}
          </span>
        </div>

        <div className="space-y-4">
           {hasBackupConfig && backupFreq !== 'never' && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-sm font-medium text-green-400">Backups Active</span>
                </div>
                <p className="text-sm text-theme-secondary">
                  Your database will back up to this folder on a {backupFreq} schedule while the app is open.
                </p>
              </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             <div className="p-3 rounded border border-theme-primary bg-theme-primary">
               <div className="text-xs text-theme-secondary mb-1">Last attempted run</div>
               <div className="text-sm text-theme-primary">{formatBackupTime(backupLastRunAt)}</div>
             </div>
             <div className="p-3 rounded border border-theme-primary bg-theme-primary">
               <div className="text-xs text-theme-secondary mb-1">Last successful backup</div>
               <div className="text-sm text-theme-primary">{formatBackupTime(backupLastSuccessAt)}</div>
             </div>
           </div>

           <div className="p-3 rounded border border-theme-primary bg-theme-primary space-y-2">
             <div>
               <div className="text-xs text-theme-secondary mb-1">Last result</div>
               <div className={`text-sm ${backupLastError ? 'text-red-400' : 'text-theme-primary'}`}>
                 {backupLastError || 'No recent backup errors'}
               </div>
             </div>
             {backupLastPath && (
               <div>
                 <div className="text-xs text-theme-secondary mb-1">Last backup file</div>
                 <div className="text-sm text-theme-primary break-all">{backupLastPath}</div>
               </div>
             )}
           </div>

           <div className="grid gap-2">
             <label className="text-sm text-theme-secondary">Backup Directory</label>
             <div className="flex gap-2">
               <input type="text" readOnly placeholder="Click Select Folder" value={backupDir} className="w-full p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary focus:outline-none focus:ring" />
               <Button className="px-3 rounded bg-blue-500 text-white whitespace-nowrap" onClick={handleSelectBackupDir}>Select Folder</Button>
             </div>
           </div>
           
           <div className="grid gap-2">
             <label className="text-sm text-theme-secondary">Backup Frequency</label>
             <select value={backupFreq} onChange={e => setBackupFreq(e.target.value)} className="w-full p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary focus:outline-none focus:ring">
                <option value="never">Never (Disabled)</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
             </select>
           </div>
           
           <div className="flex flex-wrap gap-3">
             <Button className="px-4 py-2 rounded bg-brand-primary text-white" onClick={handleSetBackupConfig} disabled={settingBackup}>
                {settingBackup ? 'Saving...' : 'Save Configuration'}
             </Button>
             <Button onClick={handleRunBackupNow} disabled={runningBackup || !hasBackupConfig || !backupDir.trim()}>
                {runningBackup ? 'Running Backup...' : 'Run Backup Now'}
             </Button>
           </div>

           <div className="text-xs text-theme-secondary">
             Automatic backups do not run after the app is closed. Keep the app open if you want the schedule to execute.
           </div>
        </div>
      </div>

      {/* Import Collections Card */}
      <div className="bg-theme-card border border-theme-primary rounded-lg p-6 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Import Collections</h2>
            <p className="text-sm text-theme-secondary">Import collections from a ZIP created by this app. Lossless exports use `.ejson`; legacy `.json` and `.csv` files are also supported.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleImportCollections} disabled={importing} >
              {importing ? 'Importing…' : 'Import from ZIP'}
            </Button>
          </div>
        </div>
        <div className="text-xs text-theme-secondary">Note: Existing documents with the same _id may cause duplicates unless the IDs match; insertion is unordered for speed.</div>
      </div>
      {/* Export Collections Card */}
      <div className="bg-theme-card border border-theme-primary rounded-lg p-6 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Export Collections</h2>
            <p className="text-sm text-theme-secondary">Export selected collections to a ZIP archive. Use `EJSON` to preserve Mongo `ObjectId` and `Date` values, or `CSV` for spreadsheet-friendly data.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={exportFormat}
              onChange={e => setExportFormat((e.target.value as 'ejson' | 'json' | 'csv'))}
              className="p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary"
            >
              <option value="ejson">EJSON (Preserve IDs/Dates)</option>
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
            <Button onClick={loadCollections} disabled={colLoading || exporting}>
              {colLoading ? 'Loading…' : 'Load Collections'}
            </Button>
            <Button
              className={`px-4 py-2 rounded ${theme.bg.tertiary} text-white hover:opacity-90 disabled:opacity-60`}
              onClick={handleExportCollections}
              disabled={exporting || selectedNames.length === 0}
            >
              {exporting ? 'Exporting…' : `Export Selected (${selectedNames.length})`}
            </Button>
          </div>
        </div>

        <div className="border border-theme-primary rounded">
          {collections.length === 0 && !colLoading ? (
            <div className="p-4 text-sm text-theme-secondary">No collections loaded. Click "Load Collections".</div>
          ) : (
            <div className="max-h-72 overflow-auto">
              <div className="flex items-center gap-3 p-3 border-b border-theme-primary sticky top-0 bg-theme-card">
                <input
                  id="exp-select-all"
                  type="checkbox"
                  checked={collections.length > 0 && selectedNames.length === collections.length}
                  onChange={handleToggleAll}
                />
                <label htmlFor="exp-select-all" className="text-sm">Select All</label>
              </div>
              {collections.map((name) => (
                <label key={`exp-${name}`} className="flex items-center gap-3 p-3 border-b border-theme-primary text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selected[name]}
                    onChange={() => handleToggle(name)}
                  />
                  <span className="font-mono">{name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="text-xs text-theme-secondary">Note: Complex nested fields may not render well in CSV. Use JSON for full fidelity.</div>
      </div>
      {/* Delete Collections Card */}
      <div className="bg-theme-card border border-theme-primary rounded-lg p-6 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Delete Collections</h2>
            <p className="text-sm text-theme-secondary">Fetch collections and drop selected ones. Be careful: this permanently deletes data.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={loadCollections} disabled={colLoading || dropping}>
              {colLoading ? 'Loading…' : 'Load Collections'}
            </Button>
            <Button
              className="px-4 py-2 rounded bg-red-500/80 text-white hover:bg-red-500 disabled:opacity-60"
              onClick={handleDropCollections}
              disabled={dropping || selectedNames.length === 0}
            >
              {dropping ? 'Deleting…' : `Delete Selected (${selectedNames.length})`}
            </Button>
          </div>
        </div>

        <div className="border border-theme-primary rounded">
          {collections.length === 0 && !colLoading ? (
            <div className="p-4 text-sm text-theme-secondary">No collections loaded. Click "Load Collections".</div>
          ) : (
            <div className="max-h-72 overflow-auto">
              <div className="flex items-center gap-3 p-3 border-b border-theme-primary sticky top-0 bg-theme-card">
                <input
                  id="select-all"
                  type="checkbox"
                  checked={collections.length > 0 && selectedNames.length === collections.length}
                  onChange={handleToggleAll}
                />
                <label htmlFor="select-all" className="text-sm">Select All</label>
              </div>
              {collections.map((name) => (
                <label key={name} className="flex items-center gap-3 p-3 border-b border-theme-primary text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selected[name]}
                    onChange={() => handleToggle(name)}
                  />
                  <span className="font-mono">{name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="text-xs text-theme-secondary">Note: System collections are hidden and cannot be deleted.</div>
      </div>
    </div>
  );
};

export default SettingsPage;
