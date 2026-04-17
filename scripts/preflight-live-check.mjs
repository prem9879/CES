import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const reportsDir = path.join(root, 'artifacts', 'reports')

function parseEnvFile(content) {
  const out = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function loadMergedEnv() {
  const files = ['.env', '.env.local', '.env.production']
  const merged = {}

  for (const rel of files) {
    const abs = path.join(root, rel)
    if (!fs.existsSync(abs)) continue
    const parsed = parseEnvFile(fs.readFileSync(abs, 'utf8'))
    Object.assign(merged, parsed)
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') merged[key] = value
  }

  return merged
}

function sanitizeUrl(urlText) {
  if (!urlText) return null
  try {
    return new URL(urlText)
  } catch {
    return null
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function nowIso() {
  return new Date().toISOString()
}

const checks = []

function addCheck(status, name, details, evidence = '') {
  checks.push({ status, name, details, evidence })
}

function countStatuses() {
  const summary = { pass: 0, warn: 0, fail: 0, manual: 0 }
  for (const c of checks) {
    summary[c.status] += 1
  }
  return summary
}

function iconFor(status) {
  if (status === 'pass') return 'PASS'
  if (status === 'warn') return 'WARN'
  if (status === 'manual') return 'MANUAL'
  return 'FAIL'
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'follow',
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

async function checkUrlHealth(url, timeoutMs) {
  try {
    let response = await fetchWithTimeout(url, { method: 'HEAD' }, timeoutMs)
    if (response.status === 405 || response.status === 403) {
      response = await fetchWithTimeout(url, { method: 'GET' }, timeoutMs)
    }

    return {
      ok: response.status >= 200 && response.status < 500,
      status: response.status,
      statusText: response.statusText,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

function listFilesRecursively(dirPath) {
  const out = []
  if (!fs.existsSync(dirPath)) return out

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const abs = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'out') continue
      out.push(...listFilesRecursively(abs))
    } else {
      out.push(abs)
    }
  }

  return out
}

function relative(absPath) {
  return path.relative(root, absPath).replace(/\\/g, '/')
}

async function run() {
  const env = loadMergedEnv()
  const timeoutMs = Number(env.PREFLIGHT_TIMEOUT_MS || '8000')
  const strictMode = String(env.PREFLIGHT_STRICT_LIVE || 'false').toLowerCase() === 'true'

  const siteUrlText = env.NEXT_PUBLIC_SITE_URL || ''
  const siteUrl = sanitizeUrl(siteUrlText)

  addCheck(
    siteUrl ? 'pass' : 'warn',
    'Production site URL configured',
    'NEXT_PUBLIC_SITE_URL should point to your deployed domain',
    siteUrlText || '(missing)'
  )

  if (siteUrl) {
    const robots = new URL('/robots.txt', siteUrl).toString()
    const sitemap = new URL('/sitemap.xml', siteUrl).toString()

    const robotsCheck = await checkUrlHealth(robots, timeoutMs)
    addCheck(
      robotsCheck.ok ? 'pass' : 'warn',
      'robots.txt reachable',
      'Public crawler policy endpoint should be reachable',
      robotsCheck.ok ? `${robots} -> ${robotsCheck.status}` : `${robots} -> ${robotsCheck.error || robotsCheck.status}`
    )

    const sitemapCheck = await checkUrlHealth(sitemap, timeoutMs)
    addCheck(
      sitemapCheck.ok ? 'pass' : 'warn',
      'sitemap.xml reachable',
      'Sitemap should be reachable for indexing',
      sitemapCheck.ok ? `${sitemap} -> ${sitemapCheck.status}` : `${sitemap} -> ${sitemapCheck.error || sitemapCheck.status}`
    )
  } else {
    addCheck('manual', 'robots.txt check skipped', 'Set NEXT_PUBLIC_SITE_URL to enable live URL checks')
    addCheck('manual', 'sitemap.xml check skipped', 'Set NEXT_PUBLIC_SITE_URL to enable live URL checks')
  }

  const staticExportEnabled = String(env.NEXT_STATIC_EXPORT || 'true').toLowerCase() !== 'false'
  if (staticExportEnabled) {
    addCheck(
      'warn',
      'Static export mode enabled',
      'Custom Next.js headers are not enforced in static export mode',
      'Set NEXT_STATIC_EXPORT=false for runtime header enforcement'
    )
  } else {
    addCheck('pass', 'Server mode enabled', 'Runtime Next.js headers can be enforced by the server')
  }

  const supabaseUrlText = env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const supabaseUrl = sanitizeUrl(supabaseUrlText)

  if (!supabaseUrlText || !supabaseAnonKey) {
    addCheck('warn', 'Supabase env variables configured', 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for auth flows')
  } else if (!supabaseUrl) {
    addCheck('fail', 'Supabase URL valid', 'NEXT_PUBLIC_SUPABASE_URL is not a valid URL', supabaseUrlText)
  } else {
    addCheck('pass', 'Supabase URL valid', 'NEXT_PUBLIC_SUPABASE_URL parses correctly', supabaseUrl.origin)

    const jwtShape = supabaseAnonKey.split('.').length === 3
    addCheck(jwtShape ? 'pass' : 'warn', 'Supabase anon key shape check', 'Anon key usually has JWT shape (three dot-separated parts)')

    const settingsEndpoint = new URL('/auth/v1/settings', supabaseUrl).toString()
    try {
      const response = await fetchWithTimeout(
        settingsEndpoint,
        {
          method: 'GET',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        },
        timeoutMs
      )

      if (!response.ok) {
        addCheck('warn', 'Supabase Auth settings reachable', 'Could not read auth settings endpoint with anon key', `${response.status} ${response.statusText}`)
      } else {
        const settings = await response.json()
        addCheck('pass', 'Supabase Auth settings reachable', 'Read auth settings successfully', settingsEndpoint)

        if (typeof settings.disable_signup === 'boolean') {
          addCheck(
            settings.disable_signup ? 'warn' : 'pass',
            'Email signup availability',
            settings.disable_signup ? 'Email signup appears disabled' : 'Email signup appears enabled',
            `disable_signup=${settings.disable_signup}`
          )
        } else {
          addCheck('manual', 'Email signup availability', 'Could not infer signup setting from Supabase response shape')
        }

        const external = settings.external || settings.external_providers || {}
        const googleEnabled = Boolean(
          external.google ||
          external.google_enabled ||
          settings.external_google_enabled
        )

        addCheck(
          googleEnabled ? 'pass' : 'warn',
          'Google OAuth provider status',
          googleEnabled ? 'Google provider appears enabled' : 'Google provider not detected in settings response'
        )
      }
    } catch (err) {
      addCheck(
        'warn',
        'Supabase Auth settings reachable',
        'Network/auth error while checking /auth/v1/settings',
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  const stripeLinks = [
    { key: 'NEXT_PUBLIC_STRIPE_LINK_PRO', value: env.NEXT_PUBLIC_STRIPE_LINK_PRO || '' },
    { key: 'NEXT_PUBLIC_STRIPE_LINK_ENTERPRISE', value: env.NEXT_PUBLIC_STRIPE_LINK_ENTERPRISE || '' },
  ]

  for (const link of stripeLinks) {
    if (!link.value) {
      addCheck('warn', `${link.key} configured`, 'Populate Stripe hosted checkout/payment link')
      continue
    }

    const parsed = sanitizeUrl(link.value)
    if (!parsed) {
      addCheck('fail', `${link.key} URL valid`, 'Configured value is not a valid URL', link.value)
      continue
    }

    const stripeHost = parsed.hostname.includes('stripe.com')
    addCheck(stripeHost ? 'pass' : 'warn', `${link.key} host check`, 'Expected a Stripe domain URL', parsed.hostname)

    const health = await checkUrlHealth(link.value, timeoutMs)
    addCheck(
      health.ok ? 'pass' : 'warn',
      `${link.key} reachable`,
      'Hosted payment link should be reachable',
      health.ok ? `${health.status}` : `${health.error || health.status}`
    )
  }

  addCheck('manual', 'Google Search Console submission status', 'Verify sitemap submitted and indexed in Google Search Console')
  addCheck('manual', 'Bing Webmaster submission status', 'Verify sitemap submitted and indexed in Bing Webmaster Tools')

  const blocklistRaw = env.BRAND_BLOCKLIST || 'legacy-brand,legacy-upstream'
  const blocklist = blocklistRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const candidateRoots = [
    path.join(root, 'src'),
    path.join(root, 'api'),
    path.join(root, 'functions'),
  ]

  const candidateFiles = [
    ...candidateRoots.flatMap(listFilesRecursively),
    path.join(root, 'README.md'),
    path.join(root, 'TERMS.md'),
    path.join(root, 'LAUNCH-CHECKLIST.md'),
    path.join(root, 'API.md'),
    path.join(root, 'index.html'),
  ].filter((abs) => fs.existsSync(abs) && fs.statSync(abs).isFile())

  let legacyMatchCount = 0
  const matchedFiles = new Set()

  for (const abs of candidateFiles) {
    const text = fs.readFileSync(abs, 'utf8').toLowerCase()
    for (const token of blocklist) {
      if (text.includes(token.toLowerCase())) {
        legacyMatchCount += 1
        matchedFiles.add(relative(abs))
      }
    }
  }

  if (legacyMatchCount > 0) {
    addCheck(
      'warn',
      'Brand uniqueness scan',
      'Legacy upstream markers found; replace these to strengthen original branding and legal clarity',
      `${legacyMatchCount} token hits across ${matchedFiles.size} files`
    )
  } else {
    addCheck('pass', 'Brand uniqueness scan', 'No blocklisted legacy markers found in scanned first-party files')
  }

  const generatedAt = nowIso()
  const summary = countStatuses()

  ensureDir(reportsDir)

  const report = {
    generatedAt,
    strictMode,
    summary,
    checks,
  }

  const jsonPath = path.join(reportsDir, 'live-systems-report.json')
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8')

  const mdLines = []
  mdLines.push('# Live Systems Report')
  mdLines.push('')
  mdLines.push(`Generated: ${generatedAt}`)
  mdLines.push(`Strict mode: ${strictMode ? 'true' : 'false'}`)
  mdLines.push('')
  mdLines.push(`- PASS: ${summary.pass}`)
  mdLines.push(`- WARN: ${summary.warn}`)
  mdLines.push(`- FAIL: ${summary.fail}`)
  mdLines.push(`- MANUAL: ${summary.manual}`)
  mdLines.push('')
  mdLines.push('## Checks')
  mdLines.push('')

  for (const check of checks) {
    mdLines.push(`- [${iconFor(check.status)}] ${check.name}: ${check.details}${check.evidence ? ` (${check.evidence})` : ''}`)
  }

  const mdPath = path.join(reportsDir, 'live-systems-report.md')
  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8')

  console.log('\nLevel-2 Live Systems Check\n')
  for (const check of checks) {
    const status = iconFor(check.status)
    const suffix = check.evidence ? ` | ${check.evidence}` : ''
    console.log(`[${status}] ${check.name} -> ${check.details}${suffix}`)
  }

  console.log(`\nSummary: PASS ${summary.pass} | WARN ${summary.warn} | FAIL ${summary.fail} | MANUAL ${summary.manual}`)
  console.log(`Report JSON: ${relative(jsonPath)}`)
  console.log(`Report MD:   ${relative(mdPath)}`)

  if (summary.fail > 0 || (strictMode && summary.warn > 0)) {
    console.log('Status: FAILED live systems checks.')
    process.exit(1)
  }

  console.log('Status: READY live systems checks passed (with warnings/manual items allowed).')
}

run().catch((err) => {
  console.error('Live systems checker crashed:', err)
  process.exit(1)
})
