// Shared shapes for hook stdin payloads. Import as `import type` so it's erased at runtime
// (bun and node --experimental-strip-types both drop type-only imports).

export interface ToolInput {
  file_path?: string
  content?: string
  old_string?: string
  new_string?: string
  [key: string]: unknown
}

export interface HookInput {
  /** PreToolUse/PostToolUse */
  tool_name?: string
  tool_input?: ToolInput
  /** UserPromptSubmit */
  prompt?: string
  /** Stop */
  stop_hook_active?: boolean
  last_assistant_message?: string
  [key: string]: unknown
}
