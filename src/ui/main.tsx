import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './contexts/AppContext';
import { DarkModeProvider } from './contexts/DarkModeContext';
import './index.css';
const container = document.getElementById('root');
if (!container) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <DarkModeProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </DarkModeProvider>
  </React.StrictMode>
);
