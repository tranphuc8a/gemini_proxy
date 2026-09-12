/**
 * Turn a request into a snippet the user can paste into their own code.
 *
 * Every generator works from the same folded view of the request that the
 * sender uses - auth already merged into headers/params - so the snippet is a
 * faithful copy of what the app itself sends, not an approximation of the form.
 */

import type { RequestSpec } from '../types'
import { buildCurl } from './curl'
import { CONTENT_TYPE_BY_MODE, applyAuth, buildUrl, extractParams, stripQuery } from './sender'
import { kvToObject } from './util'

export type CodeLanguage = 'curl' | 'fetch' | 'axios' | 'python' | 'java'

export const CODE_LANGUAGES: { id: CodeLanguage; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'fetch', label: 'JavaScript · fetch' },
  { id: 'axios', label: 'JavaScript · axios' },
  { id: 'python', label: 'Python · requests' },
  { id: 'java', label: 'Java · OkHttp' },
]

interface Folded {
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
  isMultipart: boolean
  formFields: Record<string, string>
}

function fold(spec: RequestSpec): Folded {
  const headers = kvToObject(spec.headers)
  const params = { ...extractParams(spec.url), ...kvToObject(spec.params) }
  applyAuth(spec, headers, params)

  const cookies = kvToObject(spec.cookies)
  if (Object.keys(cookies).length) {
    headers.Cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  }

  const isMultipart = spec.bodyMode === 'multipart'
  const formFields = kvToObject(spec.formFields)
  const hasBody = spec.method !== 'GET' && spec.method !== 'HEAD' && spec.bodyMode !== 'none'

  if (hasBody && !isMultipart && !Object.keys(headers).some((k) => /^content-type$/i.test(k))) {
    const contentType = CONTENT_TYPE_BY_MODE[spec.bodyMode]
    if (contentType) headers['Content-Type'] = contentType
  }

  let body: string | null = null
  if (hasBody) {
    if (spec.bodyMode === 'form') body = new URLSearchParams(formFields).toString()
    else if (!isMultipart) body = spec.body
  }

  return {
    method: spec.method,
    url: buildUrl(stripQuery(spec.url), params),
    headers,
    body,
    isMultipart,
    formFields,
  }
}

const jsString = (value: string) => JSON.stringify(value)

function fetchSnippet(f: Folded): string {
  const lines: string[] = []
  lines.push(`const response = await fetch(${jsString(f.url)}, {`)
  lines.push(`  method: ${jsString(f.method)},`)

  if (Object.keys(f.headers).length) {
    lines.push('  headers: {')
    for (const [key, value] of Object.entries(f.headers)) {
      lines.push(`    ${jsString(key)}: ${jsString(value)},`)
    }
    lines.push('  },')
  }

  if (f.isMultipart) {
    lines.unshift('')
    const form = ['const form = new FormData()']
    for (const [key, value] of Object.entries(f.formFields)) form.push(`form.append(${jsString(key)}, ${jsString(value)})`)
    form.push('// form.append("file", fileInput.files[0])')
    lines.unshift(form.join('\n'))
    lines.push('  body: form,')
  } else if (f.body !== null) {
    lines.push(`  body: ${jsString(f.body)},`)
  }

  lines.push('})')
  lines.push('')
  lines.push('const data = await response.text()')
  lines.push('console.log(response.status, data)')
  return lines.join('\n')
}

function axiosSnippet(f: Folded): string {
  const config: string[] = [
    `  method: ${jsString(f.method.toLowerCase())},`,
    `  url: ${jsString(f.url)},`,
  ]
  if (Object.keys(f.headers).length) {
    config.push('  headers: {')
    for (const [key, value] of Object.entries(f.headers)) config.push(`    ${jsString(key)}: ${jsString(value)},`)
    config.push('  },')
  }

  const prelude: string[] = ["import axios from 'axios'", '']
  if (f.isMultipart) {
    prelude.push('const form = new FormData()')
    for (const [key, value] of Object.entries(f.formFields)) prelude.push(`form.append(${jsString(key)}, ${jsString(value)})`)
    prelude.push('')
    config.push('  data: form,')
  } else if (f.body !== null) {
    // axios serialises a JS object itself; a string is sent verbatim, which is
    // what we want since the body was authored by hand.
    config.push(`  data: ${jsString(f.body)},`)
  }

  return `${prelude.join('\n')}const response = await axios({\n${config.join('\n')}\n})\n\nconsole.log(response.status, response.data)`
}

const pyString = (value: string) => {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
  return `"${escaped}"`
}

function pythonSnippet(f: Folded): string {
  const lines = ['import requests', '']

  if (Object.keys(f.headers).length) {
    lines.push('headers = {')
    for (const [key, value] of Object.entries(f.headers)) lines.push(`    ${pyString(key)}: ${pyString(value)},`)
    lines.push('}')
    lines.push('')
  }

  const args = [pyString(f.url)]
  if (Object.keys(f.headers).length) args.push('headers=headers')

  if (f.isMultipart) {
    lines.push('files = {')
    for (const [key, value] of Object.entries(f.formFields)) lines.push(`    ${pyString(key)}: (None, ${pyString(value)}),`)
    lines.push('    # "file": open("path/to/file", "rb"),')
    lines.push('}')
    lines.push('')
    args.push('files=files')
  } else if (f.body !== null) {
    lines.push(`payload = ${pyString(f.body)}`)
    lines.push('')
    args.push('data=payload.encode("utf-8")')
  }

  lines.push(`response = requests.request(${pyString(f.method)}, ${args.join(', ')})`)
  lines.push('print(response.status_code)')
  lines.push('print(response.text)')
  return lines.join('\n')
}

const javaString = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`

function javaSnippet(f: Folded): string {
  const lines = [
    'OkHttpClient client = new OkHttpClient();',
    '',
  ]

  let bodyExpression = 'null'
  if (f.isMultipart) {
    lines.push('MultipartBody.Builder formBuilder = new MultipartBody.Builder().setType(MultipartBody.FORM);')
    for (const [key, value] of Object.entries(f.formFields)) {
      lines.push(`formBuilder.addFormDataPart(${javaString(key)}, ${javaString(value)});`)
    }
    lines.push('RequestBody body = formBuilder.build();')
    lines.push('')
    bodyExpression = 'body'
  } else if (f.body !== null) {
    const contentType = f.headers['Content-Type'] ?? 'text/plain'
    lines.push(`MediaType mediaType = MediaType.parse(${javaString(contentType)});`)
    lines.push(`RequestBody body = RequestBody.create(${javaString(f.body)}, mediaType);`)
    lines.push('')
    bodyExpression = 'body'
  }

  lines.push('Request request = new Request.Builder()')
  lines.push(`    .url(${javaString(f.url)})`)
  lines.push(`    .method(${javaString(f.method)}, ${bodyExpression})`)
  for (const [key, value] of Object.entries(f.headers)) {
    lines.push(`    .addHeader(${javaString(key)}, ${javaString(value)})`)
  }
  lines.push('    .build();')
  lines.push('')
  lines.push('try (Response response = client.newCall(request).execute()) {')
  lines.push('    System.out.println(response.code());')
  lines.push('    System.out.println(response.body().string());')
  lines.push('}')
  return lines.join('\n')
}

export function generateCode(spec: RequestSpec, language: CodeLanguage): string {
  if (language === 'curl') return buildCurl(spec, { followRedirects: true })
  const folded = fold(spec)
  switch (language) {
    case 'fetch': return fetchSnippet(folded)
    case 'axios': return axiosSnippet(folded)
    case 'python': return pythonSnippet(folded)
    case 'java': return javaSnippet(folded)
  }
}
