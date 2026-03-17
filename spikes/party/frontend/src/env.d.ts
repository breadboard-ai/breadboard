/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRANSPORT?: "websocket" | "firestore";
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIRESTORE_DATABASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
