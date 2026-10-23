// FILE SINH RA — ĐỪNG SỬA Ở ĐÂY. Nguồn thật: markdown-editor/src/lib/katexOptions.ts
// Sửa ở nguồn rồi chạy: node scripts/sync-math.mjs   (kiểm lệch: node scripts/sync-math.mjs --kiem)
/**
 * KaTeX settings for maths as chat assistants write it. Pure (no imports), so `scripts/sync-math.mjs` can copy it to
 * gemini-chat (`frontend/src/lib/`) together with `mathDelimiters.ts` and `remarkMathPromote.ts`.
 */

/**
 * Macros for what LLM answers borrow from LaTeX/MathJax that KaTeX lacks: equation labels and references render as
 * their text instead of a red error. A fresh copy per render: KaTeX writes `\gdef`s into the object it is given.
 */
export const KATEX_MACROS: Readonly<Record<string, string>> = Object.freeze({
  '\\label': '\\mathrlap{\\phantom{\\text{#1}}}',
  '\\eqref': '\\text{(#1)}',
  '\\ref': '\\text{#1}'
})

/** KaTeX settings: no warnings for LaTeX-incompatible input (chat answers are full of it), the macros above. */
export function katexOptions() {
  return { strict: 'ignore' as const, macros: { ...KATEX_MACROS } }
}
