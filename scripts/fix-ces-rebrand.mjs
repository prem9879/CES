// Fix environment variable names - keep them as CES_* but display as CES
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const fixes = {
  'api/lib/tiers.ts': [
    ['process.env.Cognitive Execution System (CES)_TIER_KEYS', 'process.env.CES_TIER_KEYS'],
    ['process.env.Cognitive Execution System (CES)_API_KEY', 'process.env.CES_API_KEY']
  ],
  'api/middleware/auth.ts': [
    ['process.env.Cognitive Execution System (CES)_API_KEYS', 'process.env.CES_API_KEYS'],
    ['process.env.Cognitive Execution System (CES)_API_KEY', 'process.env.CES_API_KEY']
  ],
  'src/store/index.ts': [
    ['ces-core', 'ces-core'],  // Keep as is
    ['ces-storage', 'ces-storage']  // Keep as is
  ]
}

let count = 0
for (const [file, replacements] of Object.entries(fixes)) {
  const path = join(process.cwd(), file)
  try {
    let content = readFileSync(path, 'utf-8')
    for (const [from, to] of replacements) {
      if (content.includes(from)) {
        content = content.replace(from, to)
        count++
      }
    }
    writeFileSync(path, content)
    console.log(`✅ Fixed ${file}`)
  } catch (err) {
    console.log(`⚠️  ${file}: ${err.message}`)
  }
}

console.log(`\n✨ Fixed ${count} issues`)
