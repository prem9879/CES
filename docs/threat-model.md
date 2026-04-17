# Threat Model

## Scope

- Frontend: chat UI, multimodal input layer
- API: chat orchestration, provider proxying, tier/rate controls
- Storage: local browser persistence, optional dataset telemetry

## Assets

- Provider credentials (`OPENROUTER_API_KEY`, optional `OPENAI_API_KEY`)
- User prompts and assistant responses
- Attachment-derived content (OCR text, transcripts)
- Tier and billing metadata

## Primary Threats

### Credential leakage

- Risk: secrets exposed in client bundle, logs, or git history
- Controls: server-only env vars, no client secret embedding, and `.gitignore` hygiene

### Prompt and attachment data exfiltration

- Risk: sensitive content sent to third-party providers
- Controls: no-log forwarding, explicit privacy messaging, and optional local fallback

### Abuse and denial of service

- Risk: large payload spam or burst requests
- Controls: per-tier rate limiting, body size limits, and endpoint auth

### Injection and unsafe rendering

- Risk: markdown/code rendering abuse
- Controls: markdown rendering constraints and no arbitrary HTML execution

### Unauthorized endpoint use

- Risk: non-authenticated direct API abuse
- Controls: bearer auth middleware and tier gating

## Residual Risks

- Third-party model-provider outages and policy filtering behavior
- Audio transcription quality depends on external model and input quality
- OCR quality varies by image resolution and language

## Recommended Next Controls

1. Add request signing for privileged internal endpoints
1. Add malware scanning for binary attachments before processing
1. Add SIEM sink and alerting for auth and rate-limit anomalies
1. Add e2e abuse tests for payload and concurrency limits
