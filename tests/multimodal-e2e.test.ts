import assert from 'node:assert/strict'
import { buildAttachmentContext } from '../src/lib/multimodal'

async function run() {
  const context = buildAttachmentContext([
    {
      id: 'image-1',
      type: 'image',
      name: 'spec-sheet.png',
      mimeType: 'image/png',
      sizeBytes: 128000,
      width: 1200,
      height: 800,
      ocrText: 'Galaxy S26 Ultra 200MP camera 5000mAh battery',
      visionSummary: 'A product spec slide comparing camera and battery capabilities.',
    },
    {
      id: 'audio-1',
      type: 'audio',
      name: 'briefing.m4a',
      mimeType: 'audio/mp4',
      sizeBytes: 4800000,
      durationSec: 42,
      transcription: 'Recommend the model with better thermals and the most reliable camera pipeline.',
      transcriptionQuality: 'high',
    },
    {
      id: 'pdf-1',
      type: 'pdf',
      name: 'launch-notes.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 940000,
      pageCount: 4,
      extractedText: 'Official launch notes confirm expanded battery life and updated display calibration.',
    },
  ])

  assert.ok(context.includes('[MULTIMODAL INPUTS]'))
  assert.ok(context.includes('OCR:'))
  assert.ok(context.includes('Vision summary:'))
  assert.ok(context.includes('Transcript (high):'))
  assert.ok(context.includes('Extracted text:'))

  console.log('Multimodal e2e test passed.')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
