import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'

const { tool_name, tool_input } = JSON.parse(await readStdin())

if (tool_name !== 'Edit' && tool_name !== 'Write') pass()

const file = tool_input?.file_path ?? ''
if (!file.endsWith('.tsx') && !file.endsWith('.ts')) pass()

const content = tool_name === 'Edit' ? tool_input?.new_string : tool_input?.content
if (content && /\bt\(['"]/.test(content)) {
  inject('PostToolUse', `New t() calls detected. Run \`yarn i18n:extract\` to update translation files.
Do not edit locale JSON files directly.
(core/frontend/i18n.md § Adding new translated text)`)
}

pass()
