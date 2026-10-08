/**
 * Fence names people actually type, mapped to the grammar names the Prism
 * async-light build can load. It only knows full names, so ```js, ```ts or
 * ```py used to fall back to plain text and never got highlighted.
 */
const ALIASES: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  py: 'python',
  py3: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  yml: 'yaml',
  md: 'markdown',
  cs: 'csharp',
  'c#': 'csharp',
  rb: 'ruby',
  rs: 'rust',
  kt: 'kotlin',
  kts: 'kotlin',
  ps1: 'powershell',
  pwsh: 'powershell',
  dockerfile: 'docker',
  golang: 'go',
  'c++': 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  h: 'c',
  jsonc: 'json',
  json5: 'json'
}

/** The grammar to highlight a fence with; unknown names pass through unchanged. */
export function prismLanguage(fence: string): string {
  const name = fence.trim().toLowerCase()
  return ALIASES[name] ?? name
}
