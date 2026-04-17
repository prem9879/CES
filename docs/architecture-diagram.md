# CES Launch Architecture Diagram

```mermaid
flowchart TD
  U[User] --> UI[Next.js Frontend]
  UI --> CI[ChatInput Multimodal Layer]
  CI --> OCR[Local OCR via tesseract.js]
  CI --> PDF[PDF Text Extraction via pdfjs]
  CI --> API[CES API Server]

  API --> CHAT[/v1/chat/completions]
  API --> IMG[/v1/chat/analyze-image]
  API --> AUD[/v1/chat/transcribe-audio]
  API --> ULTRA[/v1/ultraplinian/completions]
  API --> CONS[/v1/consortium/completions]

  CHAT --> OR[OpenRouter Models]
  IMG --> OR
  ULTRA --> OR
  CONS --> OR

  AUD --> OA[OpenAI Transcription\n(gpt-4o-mini-transcribe)]

  API --> META[Metadata + Dataset + Telemetry]
  UI --> STORE[Zustand State + Local Persistence]

  subgraph Security Controls
    AUTH[Bearer Auth + Tier Gate]
    RATE[Rate Limiting]
    HEAD[Security Headers]
    NOLOG[No-Log Mode Forwarding]
  end

  API --> AUTH
  API --> RATE
  API --> HEAD
  CHAT --> NOLOG
```

## Runtime Notes

- Image OCR is processed client-side and enriched with server-side vision summary.
- Audio transcription quality is high when `OPENAI_API_KEY` is configured on the API server.
- Multimodal prompts remain OpenAI-compatible by embedding normalized media context in user content.
