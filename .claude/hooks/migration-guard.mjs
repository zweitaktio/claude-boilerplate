import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'

const { tool_name, tool_input } = JSON.parse(await readStdin())

if (tool_name !== 'Write' && tool_name !== 'Edit') pass()

const file = tool_input?.file_path ?? ''

const isMigration = /\/migrations\//.test(file) || /\/migrate\.\w+$/.test(file) || /migration/i.test(file.split('/').pop())
const isSchema = /\/schema\.\w+$/.test(file) || /\/schema\//.test(file) || /\.schema\.(ts|js|json)$/.test(file)

if (isMigration || isSchema) {
  const kind = isMigration ? 'migration' : 'schema'
  inject('PreToolUse', `You are editing a ${kind} file (${file}). Database ${kind} changes are irreversible in production. Confirm with the user that this change is intentional before proceeding.`)
}

pass()
