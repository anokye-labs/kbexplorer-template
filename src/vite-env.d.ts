/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KB_OWNER?: string;
  readonly VITE_KB_REPO?: string;
  readonly VITE_KB_BRANCH?: string;
  readonly VITE_KB_PATH?: string;
  readonly VITE_KB_TITLE?: string;
  readonly VITE_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
