export interface BuildBlueprintInput {
  prompt: string
  stackHint?: string
}

export interface GeneratedFile {
  path: string
  content: string
}

export interface BuildBlueprint {
  summary: string
  stack: {
    frontend: string
    backend: string
    database: string
    deploy: string
  }
  tree: string[]
  files: GeneratedFile[]
  deploymentSteps: string[]
}

const DEFAULT_STACK = {
  frontend: 'Next.js + TypeScript',
  backend: 'Express + TypeScript',
  database: 'PostgreSQL',
  deploy: 'Docker Compose'
}

function detectStack(stackHint?: string): BuildBlueprint['stack'] {
  if (!stackHint) return DEFAULT_STACK

  const hint = stackHint.toLowerCase()
  return {
    frontend: hint.includes('react') || hint.includes('next') ? 'Next.js + TypeScript' : DEFAULT_STACK.frontend,
    backend: hint.includes('node') || hint.includes('express') ? 'Express + TypeScript' : DEFAULT_STACK.backend,
    database: hint.includes('mongo') ? 'MongoDB' : hint.includes('sqlite') ? 'SQLite' : DEFAULT_STACK.database,
    deploy: hint.includes('k8') || hint.includes('kubernetes') ? 'Kubernetes' : DEFAULT_STACK.deploy
  }
}

export function generateBuildBlueprint(input: BuildBlueprintInput): BuildBlueprint {
  const stack = detectStack(input.stackHint)

  const tree = [
    'app/',
    'app/src/',
    'app/src/pages/',
    'app/src/components/',
    'app/src/api/',
    'app/src/core/',
    'app/src/data/',
    'app/tests/',
    'app/docker/'
  ]

  const files: GeneratedFile[] = [
    {
      path: 'app/src/pages/index.tsx',
      content: `export default function HomePage() {\n  return (\n    <main>\n      <h1>CES Generated Application</h1>\n      <p>Project initialized from Build Mode.</p>\n    </main>\n  )\n}\n`
    },
    {
      path: 'app/src/api/server.ts',
      content: `import express from 'express'\n\nconst app = express()\napp.use(express.json())\n\napp.get('/health', (_req, res) => {\n  res.json({ ok: true })\n})\n\napp.listen(3001, () => {\n  console.log('API listening on :3001')\n})\n`
    },
    {
      path: 'app/src/core/contracts.ts',
      content: `export interface BuildRequest {\n  prompt: string\n  mode: 'build'\n}\n\nexport interface BuildResponse {\n  status: 'ok'\n  projectName: string\n}\n`
    },
    {
      path: 'app/docker/docker-compose.yml',
      content: `services:\n  web:\n    image: node:20\n    working_dir: /workspace\n    command: npm run dev\n    volumes:\n      - ./:/workspace\n    ports:\n      - \"3000:3000\"\n  api:\n    image: node:20\n    working_dir: /workspace\n    command: npm run api:dev\n    volumes:\n      - ./:/workspace\n    ports:\n      - \"3001:3001\"\n`
    }
  ]

  const deploymentSteps = [
    'Install dependencies: npm install',
    'Run local services: docker compose -f app/docker/docker-compose.yml up',
    'Run tests: npm run test',
    'Build production bundle: npm run build',
    'Deploy container stack to target environment'
  ]

  return {
    summary: `Build blueprint generated for: ${input.prompt}`,
    stack,
    tree,
    files,
    deploymentSteps
  }
}
