/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MARKDOWN_API_URL?: string
  readonly VITE_MARKDOWN_ADMIN_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
