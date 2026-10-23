/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MARKDOWN_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Side-effect module: registers mhchem's \ce and \pu macros on KaTeX. Ships without types. */
declare module 'katex/contrib/mhchem'
