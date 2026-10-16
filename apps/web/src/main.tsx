import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import './i18n';
import App from './App.tsx';
import { installNativeValidation } from './lib/native-validation';
import { initSentry } from './lib/sentry';

initSentry();
installNativeValidation();

// After a deploy, a tab still running the old bundle requests chunk hashes that
// no longer exist. Reload once to pick up the new index; the timestamp guard
// avoids a reload loop if the chunk is genuinely missing.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'chunkReloadAt';
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return; // no storage = no loop guard; let the error surface instead
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
