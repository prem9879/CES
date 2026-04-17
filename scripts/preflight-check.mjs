import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath))
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8')
}

const checks = []

function addCheck(name, pass, details) {
  checks.push({ name, pass, details })
}

// Legal/compliance surfaces
addCheck('Privacy Policy page exists', exists('src/app/privacy-policy/page.tsx'), 'src/app/privacy-policy/page.tsx')
addCheck('Terms page exists', exists('src/app/terms/page.tsx'), 'src/app/terms/page.tsx')
addCheck('Cookies Policy page exists', exists('src/app/cookies-policy/page.tsx'), 'src/app/cookies-policy/page.tsx')

// Auth surface
addCheck('Auth page exists', exists('src/app/auth/page.tsx'), 'src/app/auth/page.tsx')
addCheck('Auth reset page exists', exists('src/app/auth/reset/page.tsx'), 'src/app/auth/reset/page.tsx')

// Billing surface
addCheck('Billing page exists', exists('src/app/billing/page.tsx'), 'src/app/billing/page.tsx')

// SEO surface
addCheck('robots route exists', exists('src/app/robots.ts'), 'src/app/robots.ts')
addCheck('sitemap route exists', exists('src/app/sitemap.ts'), 'src/app/sitemap.ts')

// Consent + tracking wiring
const providersPath = 'src/components/Providers.tsx'
if (exists(providersPath)) {
  const providers = read(providersPath)
  addCheck('Cookie banner wired in Providers', providers.includes('<CookieBanner />'), providersPath)
  addCheck('Page tracker wired in Providers', providers.includes('<PageTracker />'), providersPath)
} else {
  addCheck('Providers file exists', false, providersPath)
}

// Env baseline
const envPath = '.env.example'
if (exists(envPath)) {
  const env = read(envPath)
  const requiredEnv = [
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_STRIPE_LINK_PRO',
    'NEXT_PUBLIC_STRIPE_LINK_ENTERPRISE',
  ]

  for (const key of requiredEnv) {
    addCheck(`Env template contains ${key}`, env.includes(`${key}=`), envPath)
  }
} else {
  addCheck('.env.example exists', false, envPath)
}

// Ops guide
addCheck('Launch checklist exists', exists('LAUNCH-CHECKLIST.md'), 'LAUNCH-CHECKLIST.md')

const passed = checks.filter((c) => c.pass).length
const failed = checks.length - passed

console.log('\nNOVAOS Preflight Baseline Check\n')
for (const c of checks) {
  const icon = c.pass ? 'PASS' : 'FAIL'
  console.log(`[${icon}] ${c.name} (${c.details})`)
}

console.log(`\nSummary: ${passed}/${checks.length} checks passed.`)
if (failed > 0) {
  console.log('Status: FAILED baseline checks.')
  process.exit(1)
}

console.log('Status: READY baseline checks passed.')
