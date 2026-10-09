import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { isBrainLabHash } from './internal-lab';
import './styles.css';

const root = document.getElementById('root')!;

// Internal Brain Lab. The flag is compared inline so the bundler can drop the
// dynamic import (and the whole lab chunk) from builds that do not set it.
// When it is on, the lab opens INSTEAD of the app, so no profile, auth, sync or
// storage code runs on the lab page.
if (import.meta.env.VITE_INTERNAL_BRAIN_LAB === 'true' && isBrainLabHash(window.location.hash)) {
  void import('./ui/brain-lab/mount').then((lab) => lab.mountBrainLab(root));
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
