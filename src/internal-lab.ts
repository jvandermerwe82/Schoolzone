/**
 * Internal Brain Lab entry rules.
 *
 * The lab is an internal, read-only explainer that runs the real engine on
 * synthetic learners. It is shipped only in builds made with
 * VITE_INTERNAL_BRAIN_LAB=true, and only opens at this hash route. When the
 * flag is off, main.tsx never references the lab module, so the bundler leaves
 * it out of the default and production build entirely.
 */
export const BRAIN_LAB_HASH = '#/internal/brain-lab';

export const isBrainLabHash = (hash: string): boolean => hash === BRAIN_LAB_HASH || hash.startsWith(`${BRAIN_LAB_HASH}/`);
