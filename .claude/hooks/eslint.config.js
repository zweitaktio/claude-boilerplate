// Stripped-down flat config for the webstack hooks — derived from doitdeco's frontend eslint config.
// Scope: the converted TypeScript hooks + core runtime. Legacy top-level *.mjs hooks are ignored until
// they're converted to .ts (they lint-in as they migrate). Dropped vs doitdeco: react, react-hooks,
// react-compiler, check-file, vitest, perfectionist, and type-aware rules (no projectService here).
import importX from 'eslint-plugin-import-x'
import unicorn from 'eslint-plugin-unicorn'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  // node_modules, generated declarations, and not-yet-converted legacy hooks
  { ignores: ['node_modules/**', 'core/*.d.mts', '*.mjs'] },

  {
    files: ['**/*.ts', 'core/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
      parser: tseslint.parser,
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importX,
    },
    rules: {
      'import/no-duplicates': ['warn', { 'prefer-inline': true }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^(_|ignored)',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^(_|ignored)',
        },
      ],
    },
  },

  // Unicorn — recommended plus doitdeco's curated off-list (mirrored verbatim, minus the ones that
  // can only fire in React/browser code). Two rules doitdeco enforces post-migration stay ON.
  unicorn.configs.recommended,
  {
    rules: {
      // Node/TS hook scripts legitimately do these:
      'unicorn/no-process-exit': 'off',
      'unicorn/no-top-level-side-effects': 'off',
      'unicorn/no-top-level-assignment-in-function': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/no-declarations-before-early-exit': 'off',
      'unicorn/no-null': 'off',
      // Naming / abbreviation policing — off (matches doitdeco):
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/name-replacements': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/consistent-compound-words': 'off',
      // Pure style — off (matches doitdeco):
      'unicorn/import-style': 'off',
      'unicorn/max-nested-calls': 'off',
      'unicorn/consistent-class-member-order': 'off',
      'unicorn/no-break-in-nested-loop': 'off',
      'unicorn/no-nested-ternary': 'off',
      'unicorn/prefer-ternary': 'off',
      'unicorn/prefer-minimal-ternary': 'off',
      'unicorn/prefer-simple-condition-first': 'off',
      'unicorn/prefer-single-call': 'off',
      // Auto-fixes that break contracts / are too aggressive — off (matches doitdeco):
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-for-loop': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/prefer-add-event-listener': 'off',
      'unicorn/prefer-global-this': 'off',
      'unicorn/prefer-iterator-helpers': 'off',
      'unicorn/prefer-iterator-to-array': 'off',
      'unicorn/prefer-number-coercion': 'off',
      'unicorn/prefer-spread': 'off',
      // Enforced post-migration (mirrors doitdeco): fire-and-forget must be `void`-prefixed;
      // copies use toSorted() with an explicit comparator.
      'unicorn/prefer-await': 'error',
      'unicorn/no-array-sort': 'error',
    },
  },
]
