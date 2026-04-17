import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const apply = process.argv.includes('--apply')

const explicitFiles = [
  'README.md',
  'TERMS.md',
  'API.md',
  'CONTRIBUTING.md',
  'LAUNCH-CHECKLIST.md',
  'Dockerfile',
  'Dockerfile.web',
  'docker-compose.yml',
  'index.html',
  '.env.example',
  'package.json',
  'next.config.js',
]

const includeDirs = ['src', 'api', 'functions', 'HF']
const textExts = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.d.ts', '.md', '.html', '.css', '.json', '.yml', '.yaml'])
const skipFiles = new Set(['LICENSE', 'package-lock.json'])

const replacements = [
  ['CES.AI', 'NOVAOS.AI'],
  ['CES.ai', 'novaos.ai'],
  ['ces', 'NOVAOS'],
  ['ces', 'novaos'],
  ['pliny-the-prompter/ces', 'your-org/novaos-research'],
  ['pliny-the-prompter', 'your-org'],
  ['elder-plinius', 'upstream-source'],
  ['LYS10S', 'your-org'],
]

function listFiles(dir, out) {
  if (!fs.existsSync(dir)) return
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next' || ent.name === '.git' || ent.name === 'out') continue
      listFiles(abs, out)
    } else {
      if (skipFiles.has(path.basename(abs))) continue
      if (textExts.has(path.extname(abs))) out.push(abs)
    }
  }
}

function toRel(abs) {
  return path.relative(root, abs).replace(/\\/g, '/')
}

const files = []
for (const rel of explicitFiles) {
  const abs = path.join(root, rel)
  if (fs.existsSync(abs) && fs.statSync(abs).isFile() && !skipFiles.has(path.basename(abs))) files.push(abs)
}
for (const rel of includeDirs) {
  listFiles(path.join(root, rel), files)
}

const unique = [...new Set(files)]
let changedCount = 0
let tokenReplacements = 0
const changedFiles = []

for (const abs of unique) {
  const orig = fs.readFileSync(abs, 'utf8')
  let next = orig
  let localHits = 0
  for (const [from, to] of replacements) {
    if (next.includes(from)) {
      const parts = next.split(from)
      const hitCount = parts.length - 1
      localHits += hitCount
      next = parts.join(to)
    }
  }

  if (next !== orig) {
    changedCount += 1
    tokenReplacements += localHits
    changedFiles.push(toRel(abs))
    if (apply) fs.writeFileSync(abs, next, 'utf8')
  }
}

console.log(`Mode: ${apply ? 'apply' : 'dry-run'}`)
console.log(`Files scanned: ${unique.length}`)
console.log(`Files changed: ${changedCount}`)
console.log(`Token replacements: ${tokenReplacements}`)

for (const rel of changedFiles.slice(0, 200)) {
  console.log(`- ${rel}`)
}
if (changedFiles.length > 200) {
  console.log(`... and ${changedFiles.length - 200} more`)
}
