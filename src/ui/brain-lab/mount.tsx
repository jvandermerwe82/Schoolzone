import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrainLab } from './BrainLab';
import './brain-lab.css';

/** Opens the lab in place of the app. Nothing here touches profiles, auth, sync or storage. */
export function mountBrainLab(root: HTMLElement): void {
  document.documentElement.classList.add('bl-active');
  document.title = 'SchoolZone Brain Lab (internal)';
  createRoot(root).render(
    <StrictMode>
      <BrainLab />
    </StrictMode>,
  );
}
