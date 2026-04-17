export type MessageAttachmentType = 'image' | 'audio' | 'pdf'

export interface MessageAttachment {
  id: string
  type: MessageAttachmentType
  name: string
  mimeType: string
  sizeBytes: number
  previewUrl?: string
  extractedText?: string
  ocrText?: string
  visionSummary?: string
  transcription?: string
  transcriptionQuality?: 'high' | 'standard' | 'fallback'
  pageCount?: number
  durationSec?: number
  width?: number
  height?: number
}
