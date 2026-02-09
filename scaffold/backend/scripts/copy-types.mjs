#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const backendSrc = join(__dirname, '..', 'src')
const frontendDest = join(__dirname, '..', '..', 'frontend', 'app', 'services', 'api', 'payload')

const files = [
  { src: 'payload-types.ts', dest: 'payload-types.ts' },
  { src: 'payload-custom-types.ts', dest: 'payload-custom-types.ts' },
]

for (const file of files) {
  const srcPath = join(backendSrc, file.src)
  const destPath = join(frontendDest, file.dest)

  try {
    const content = readFileSync(srcPath, 'utf-8')
    const withNoCheck = `// @ts-nocheck\n${content}`
    writeFileSync(destPath, withNoCheck, 'utf-8')
    console.log(`Copied ${file.src} -> frontend`)
  } catch (err) {
    console.error(`Failed to copy ${file.src}:`, err.message)
    process.exit(1)
  }
}

console.log('Done.')
