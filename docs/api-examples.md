# API Examples

## 1) Standard Chat Completion

```bash
curl -X POST http://localhost:7860/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-dev-mode" \
  -d '{
    "model": "openai/gpt-5.3-chat",
    "messages": [
      {"role": "user", "content": "Explain Rust ownership in 5 bullets."}
    ],
    "no_log": true
  }'
```

## 2) Image Understanding

```bash
curl -X POST http://localhost:7860/v1/chat/analyze-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-dev-mode" \
  -d '{
    "mime_type": "image/png",
    "image_base64": "<BASE64_IMAGE>",
    "prompt": "Describe this UI screenshot, list visible errors, and suggest fixes."
  }'
```

## 3) Audio Transcription

```bash
curl -X POST http://localhost:7860/v1/chat/transcribe-audio \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-dev-mode" \
  -d '{
    "mime_type": "audio/mpeg",
    "file_name": "meeting.mp3",
    "audio_base64": "<BASE64_AUDIO>"
  }'
```

## 4) ULTRAPLINIAN Multi-Model Race

```bash
curl -X POST http://localhost:7860/v1/ultraplinian/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-dev-mode" \
  -d '{
    "tier": "fast",
    "messages": [
      {"role": "user", "content": "Design a secure token rotation strategy."}
    ]
  }'
```

## 5) CONSORTIUM Synthesis

```bash
curl -X POST http://localhost:7860/v1/consortium/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-dev-mode" \
  -d '{
    "tier": "standard",
    "messages": [
      {"role": "user", "content": "Compare PostgreSQL and MongoDB for audit-heavy apps."}
    ]
  }'
```

## Error Handling Contract

- `400`: request validation failure (missing fields, malformed payload)
- `401/403`: auth or provider key rejection
- `429`: throttling/rate limits
- `5xx`: upstream/provider/server failures
