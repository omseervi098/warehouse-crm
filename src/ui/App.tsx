import React, { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Sidebar } from './components/navigation/Sidebar';
import { useTheme } from './hooks/useTheme';
import BillingPage from './pages/BillingPage';
import CompanyProfilePage from './pages/CompanyProfilePage';
import DashboardPage from './pages/DashboardPage';
import ItemsPage from './pages/ItemsPage';
import PartiesPage from './pages/PartiesPage';
import SettingsPage from './pages/SettingsPage';
import SetupPage from './pages/SetupPage';
import StockBalancePage from './pages/StockBalancePage';
import StockEntriesPage from './pages/StockEntriesPage';
import WarehouseChargesPage from './pages/WarehouseChargesPage';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isDarkMode, theme } = useTheme();
  const [needsSetup, setNeedsSetup] = useState<null | boolean>(null);
  const isMacOS = window.electron?.platform === 'darwin';

  useEffect(() => {
    let mounted = true;
    async function checkSecureConfig() {
      try {
        const res = await window.electron?.secure?.hasMongoUri?.();
        if (!mounted) return;
        if (res?.ok && res.data) setNeedsSetup(false); else setNeedsSetup(true);
      } catch {
        if (mounted) setNeedsSetup(true);
      }
    }
    checkSecureConfig();
    return () => { mounted = false; };
  }, []);

  // Global keyboard shortcut: Ctrl/Cmd + R to refresh the app
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isRefresh = (e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R');
      if (isRefresh) {
        e.preventDefault();
        window.location.reload();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <HashRouter>
      {needsSetup === null ? (
        <div className="h-screen w-screen grid place-items-center bg-theme-primary">
          <div className="text-theme-secondary">Loading…</div>
        </div>
      ) : needsSetup ? (
        <SetupPage onDone={() => setNeedsSetup(false)} />
      ) : (
        <div className={`flex h-screen bg-theme-secondary ${isMacOS ? 'macos-shell' : ''}`}>
          <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} isMacOS={isMacOS} />
          <div className={`flex-1 flex flex-col min-w-0 ${isMacOS ? 'macos-main-shell' : ''}`}>
            {isMacOS ? (
              <header
                className="h-14 bg-theme-card/85 border-b border-theme-primary shrink-0 select-none drag-region macos-titlebar flex items-center justify-center"
                onDoubleClick={() => window.electron?.window?.toggleMaximize?.()}
              >
                <div className="pointer-events-none max-w-full px-6">
                  {/* @ts-ignore */}
                  <span className={`truncate text-sm font-medium tracking-[0.02em] ${theme.text.secondary}`}>
                    {import.meta.env.VITE_APP_NAME || 'Warehouse CRM'}
                  </span>
                </div>
              </header>
            ) : (
              <header
                className="flex justify-between pl-3 h-9 bg-theme-card border-b border-theme-primary shrink-0 select-none drag-region p-0 m-0"
                onDoubleClick={() => window.electron?.window?.toggleMaximize?.()}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {/* @ts-ignore */}
                  <span className={`truncate text-sm ${theme.text.primary}`}>{import.meta.env.VITE_APP_NAME || 'Warehouse CRM'}</span>
                </div>
                <div className="flex items-center gap-1 no-drag p-0 m-0">
                  <button
                    aria-label="Refresh"
                    title="Refresh (Ctrl/Cmd + R)"
                    className={`m-0 h-10 w-10 grid place-items-center rounded hover:bg-${isDarkMode ? 'white' : 'black'}/10`}
                    onClick={() => window.location.reload()}
                  >
                    <span className="text-sm">⟳</span>
                  </button>
                  <button
                    aria-label="Minimize"
                    className={`m-0 h-10 w-10 grid place-items-center rounded hover:bg-${isDarkMode ? 'white' : 'black'}/10`}
                    onClick={() => window.electron?.window?.minimize?.()}
                  >
                    <span className="text-sm">–</span>
                  </button>
                  <button
                    aria-label="Maximize"
                    className={`m-0 h-10 w-10 grid place-items-center rounded hover:bg-${isDarkMode ? 'white' : 'black'}/10`}
                    onClick={() => window.electron?.window?.toggleMaximize?.()}
                  >
                    <span className="text-xs">▢</span>
                  </button>
                  <button
                    aria-label="Close"
                    className="m-0 h-10 w-10 grid place-items-center rounded hover:bg-red-500/90 hover:text-white"
                    onClick={() => window.electron?.window?.close?.()}
                  >
                    <span className="text-sm">×</span>
                  </button>
                </div>
              </header>
            )}

            <main className={`flex-1 overflow-y-auto bg-theme-primary ${isMacOS ? 'p-6 md:p-8' : 'p-8'}`}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/company-profile" element={<CompanyProfilePage />} />
                <Route path="/master-data" element={<ItemsPage />} />
                <Route path="/parties" element={<PartiesPage />} />
                <Route path="/stock-management/entries" element={<StockEntriesPage />} />
                <Route path="/stock-statements/balance" element={<StockBalancePage />} />
                <Route path="/warehouse-charges" element={<WarehouseChargesPage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                {/* Add more routes as needed */}
              </Routes>
            </main>
          </div>
        </div>
      )}
      <Toaster position="bottom-right" />
    </HashRouter>
  );
};

export default App;
