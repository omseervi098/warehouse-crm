import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const SetupPage: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [checking, setChecking] = useState(true);
  const [uri, setUri] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const res = await window.electron?.secure?.hasMongoUri?.();
        if (mounted) {
          if (res?.ok && res.data) {
            onDone();
          } else {
            setChecking(false);
          }
        }
      } catch (e) {
        setChecking(false);
      }
    }
    check();
    return () => { mounted = false; };
  }, [onDone]);

  const handleSave = async () => {
    if (!uri.trim()) {
      toast.error('Please enter a valid MongoDB connection URI');
      return;
    }
    setSaving(true);
    const res = await window.electron?.secure?.setMongoUri?.(uri.trim());
    setSaving(false);
    if (res?.ok) {
      toast.success('Saved and connected successfully');
      onDone();
      window.location.reload(); 
    } else {
      toast.error(res?.error || 'Failed to save Mongo URI');
    }
  };

  if (checking) {
    return (
      <div className="h-screen w-screen grid place-items-center bg-theme-primary">
        <div className="text-theme-secondary">Checking configuration…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-theme-primary p-4">
      <div className="w-full max-w-xl bg-theme-card border border-theme-primary rounded-lg shadow p-6">
        <h1 className="text-2xl font-semibold mb-2 text-brand-primary">Initial Setup</h1>
        <p className="text-sm mb-6 text-theme-secondary">
          Enter your MongoDB connection URI. It will be stored securely using the system keychain.
        </p>
        <label className="block text-sm mb-2 text-theme-secondary">MongoDB URI</label>
        <input
          type="text"
          className="w-full p-2 rounded border border-theme-primary bg-theme-primary text-theme-secondary focus:outline-none focus:ring"
          placeholder="e.g. mongodb://localhost:27017/warehouse"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
        />
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="px-4 py-2 rounded bg-black/10 text-theme-secondary hover:bg-black/20"
            onClick={() => setUri('')}
            disabled={saving}
          >
            Clear
          </button>
          <button
            className="px-4 py-2 rounded bg-brand-primary text-white hover:opacity-90 disabled:opacity-60"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
