import type { MessageAttachment, MessageAttachmentType } from '@/types/multimodal'

interface BuildAttachmentOptions {
  apiBaseUrl?: string
  cesApiKey?: string
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Unable to read file as data URL.'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error('Unable to read selected file.'))
    reader.readAsDataURL(file)
  })
}

async function getImageMetadata(file: File): Promise<Pick<MessageAttachment, 'previewUrl' | 'width' | 'height'>> {
  const previewUrl = await readAsDataUrl(file)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({
        previewUrl,
        width: img.width,
        height: img.height,
      })
    }
    img.onerror = () => {
      resolve({ previewUrl })
    }
    img.src = previewUrl
  })
}

async function getAudioMetadata(file: File): Promise<Pick<MessageAttachment, 'previewUrl' | 'durationSec'>> {
  const objectUrl = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      resolve({
        previewUrl: objectUrl,
        durationSec: Number.isFinite(audio.duration) ? Math.round(audio.duration) : undefined,
      })
    }
    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Unable to parse audio metadata.'))
    }
    audio.src = objectUrl
  })
}

async function extractPdfText(file: File, maxPages = 8, maxChars = 7000): Promise<Pick<MessageAttachment, 'extractedText' | 'pageCount'>> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`
  if (pdfjs.GlobalWorkerOptions.workerSrc !== workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const task = pdfjs.getDocument({ data: bytes })
  const doc = await task.promise

  const pageCount = doc.numPages
  const pageLimit = Math.min(pageCount, maxPages)
  const chunks: string[] = []

  for (let pageIndex = 1; pageIndex <= pageLimit; pageIndex++) {
    const page = await doc.getPage(pageIndex)
    const textContent = await page.getTextContent()
    const raw = textContent.items
      .map((item) => ('str' in item ? String(item.str) : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (raw) {
      chunks.push(`[Page ${pageIndex}] ${raw}`)
    }

    if (chunks.join('\n').length >= maxChars) {
      break
    }
  }

  const extractedText = chunks.join('\n').slice(0, maxChars)
  return { extractedText, pageCount }
}

async function analyzeImageViaApi(file: File, options: BuildAttachmentOptions): Promise<string | undefined> {
  if (!options.apiBaseUrl || !options.cesApiKey) return undefined

  try {
    const base64 = await fileToBase64(file)
    const response = await fetch(`${options.apiBaseUrl}/v1/chat/analyze-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.cesApiKey}`,
      },
      body: JSON.stringify({
        image_base64: base64,
        mime_type: file.type || 'image/jpeg',
        prompt: 'Describe this image with concrete details and include any visible text and actionable context for coding/debug/help tasks.',
      }),
    })

    if (!response.ok) return undefined
    const data = await response.json() as { summary?: string }
    return data.summary?.trim() || undefined
  } catch {
    return undefined
  }
}

async function transcribeAudioViaApi(file: File, options: BuildAttachmentOptions): Promise<Pick<MessageAttachment, 'transcription' | 'transcriptionQuality'>> {
  if (!options.apiBaseUrl || !options.cesApiKey) {
    return {
      transcription: 'Audio attached. High-quality server transcription is unavailable because API transcription is not configured.',
      transcriptionQuality: 'fallback',
    }
  }

  try {
    const base64 = await fileToBase64(file)
    const response = await fetch(`${options.apiBaseUrl}/v1/chat/transcribe-audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.cesApiKey}`,
      },
      body: JSON.stringify({
        audio_base64: base64,
        mime_type: file.type || 'audio/mpeg',
        file_name: file.name,
      }),
    })

    if (!response.ok) {
      return {
        transcription: 'Audio attached. Transcription request failed; try microphone dictation or configure OPENAI_API_KEY on the API server.',
        transcriptionQuality: 'fallback',
      }
    }

    const data = await response.json() as { transcript?: string; quality?: 'high' | 'standard' | 'fallback' }
    return {
      transcription: data.transcript?.trim() || 'Audio attached. Transcript was empty.',
      transcriptionQuality: data.quality || 'standard',
    }
  } catch {
    return {
      transcription: 'Audio attached. Transcription endpoint is currently unreachable.',
      transcriptionQuality: 'fallback',
    }
  }
}

export function detectAttachmentType(file: File): MessageAttachmentType | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf'
  return null
}

export function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  const kb = sizeBytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

export async function buildAttachmentFromFile(file: File, options: BuildAttachmentOptions = {}): Promise<MessageAttachment> {
  const type = detectAttachmentType(file)
  if (!type) {
    throw new Error(`Unsupported file type: ${file.name}`)
  }

  const base: MessageAttachment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  }

  if (type === 'image') {
    const [imageDataResult, visionSummaryResult] = await Promise.allSettled([
      getImageMetadata(file),
      analyzeImageViaApi(file, options),
    ])

    const imageData = imageDataResult.status === 'fulfilled' ? imageDataResult.value : { previewUrl: undefined }
    const visionSummary = visionSummaryResult.status === 'fulfilled' ? visionSummaryResult.value : undefined

    return { ...base, ...imageData, visionSummary }
  }

  if (type === 'audio') {
    const [audioDataResult, transcriptionDataResult] = await Promise.allSettled([
      getAudioMetadata(file),
      transcribeAudioViaApi(file, options),
    ])

    const audioData = audioDataResult.status === 'fulfilled' ? audioDataResult.value : { previewUrl: undefined, durationSec: undefined }
    const transcriptionData = transcriptionDataResult.status === 'fulfilled' ? transcriptionDataResult.value : { transcription: undefined, transcriptionQuality: 'fallback' as const }

    return { ...base, ...audioData, ...transcriptionData }
  }

  try {
    const pdfData = await extractPdfText(file)
    return { ...base, ...pdfData }
  } catch {
    return { ...base, extractedText: 'PDF attached. Text extraction failed, but the file is still available for context.' }
  }
}

export function buildAttachmentContext(attachments: MessageAttachment[]): string {
  if (attachments.length === 0) return ''

  const sections = attachments.map((attachment, index) => {
    if (attachment.type === 'image') {
      const dims = attachment.width && attachment.height ? `${attachment.width}x${attachment.height}` : 'unknown dimensions'
      const ocr = attachment.ocrText ? `\nOCR:\n${attachment.ocrText}` : ''
      const vision = attachment.visionSummary ? `\nVision summary:\n${attachment.visionSummary}` : ''
      return `${index + 1}. [Image] ${attachment.name} (${dims}, ${formatBytes(attachment.sizeBytes)})${ocr}${vision}`
    }

    if (attachment.type === 'audio') {
      const duration = attachment.durationSec ? `${attachment.durationSec}s` : 'unknown duration'
      const quality = attachment.transcriptionQuality ? ` (${attachment.transcriptionQuality})` : ''
      const transcript = attachment.transcription ? `\nTranscript${quality}:\n${attachment.transcription}` : ''
      return `${index + 1}. [Audio] ${attachment.name} (${duration}, ${formatBytes(attachment.sizeBytes)})${transcript}`
    }

    const text = attachment.extractedText?.trim()
    const summary = text ? `\nExtracted text:\n${text}` : '\nExtracted text unavailable.'
    const pages = attachment.pageCount ? `${attachment.pageCount} pages` : 'unknown pages'
    return `${index + 1}. [PDF] ${attachment.name} (${pages}, ${formatBytes(attachment.sizeBytes)})${summary}`
  })

  return ['[MULTIMODAL INPUTS]', ...sections].join('\n')
}
