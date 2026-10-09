/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Build flag for the internal Brain Lab. Leave unset everywhere except
   * internal previews. When it is not exactly "true" the lab code is not
   * included in the build at all.
   */
  readonly VITE_INTERNAL_BRAIN_LAB?: string;
}
