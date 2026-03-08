import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'

const input = JSON.parse(await readStdin())
const toolName = input.tool_name ?? ''
const toolInput = input.tool_input
if (!toolInput) pass()

// C4: Skip read-only operations — validation only matters for writes
if (/\b(find|findBy|findByID|findVersions|count|findGlobal)\b/.test(toolName)) pass()

const warnings = []

// Check 1: top-level "data" key wrapping fields
if ('data' in toolInput) {
  warnings.push('Fields are top-level, NOT wrapped in data. The plugin destructures reserved keys and sends the rest as field data.')
}

// Check 2: empty objects {} (recursive)
function hasEmptyObject(val) {
  if (val && typeof val === 'object') {
    if (!Array.isArray(val) && Object.keys(val).length === 0) return true
    for (const v of Object.values(val)) {
      if (hasEmptyObject(v)) return true
    }
  }
  return false
}
if (hasEmptyObject(toolInput)) {
  warnings.push('Empty objects are prohibited — Payload rejects or silently corrupts.')
}

// Check 3: null values (recursive)
function hasNull(val) {
  if (val === null) return true
  if (val && typeof val === 'object') {
    for (const v of Object.values(val)) {
      if (hasNull(v)) return true
    }
  }
  return false
}
if (hasNull(toolInput)) {
  warnings.push('Do not use null for enum fields — omit the field instead.')
}

// Check 4: SEO field length limits
const seoTitle = toolInput.seoTitle ?? toolInput.meta?.title
const seoDesc = toolInput.seoSummary ?? toolInput.seoDescription ?? toolInput.meta?.description
if (typeof seoTitle === 'string' && seoTitle.length > 60) {
  warnings.push(`seoTitle is ${seoTitle.length} chars — max 60. Truncate or rewrite.`)
}
if (typeof seoDesc === 'string' && seoDesc.length > 160) {
  warnings.push(`seoSummary/seoDescription is ${seoDesc.length} chars — max 160. Truncate or rewrite.`)
}

// Check 5: relation fields should be IDs (numbers), not populated objects
for (const [key, val] of Object.entries(toolInput)) {
  if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null && 'id' in val[0]) {
    warnings.push(`"${key}" contains populated objects — use plain IDs (numbers) for relation fields.`)
    break
  }
}

if (warnings.length) {
  inject('PreToolUse', warnings.join('\n\n') + '\n(core/process/payload-api.md § Payload Validation)')
}
pass()
