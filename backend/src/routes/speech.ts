import { withAuth } from "../middleware/auth"
import { config } from "../config"
import { log } from "../utils"

const OPENAI_API_BASE = "https://api.openai.com/v1"

// Maximum file size: 10MB (Whisper API limit is 25MB, we use 10MB for safety)
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Supported audio formats by Whisper
const SUPPORTED_FORMATS = [
  'audio/webm',
  'audio/mp3',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/m4a',
]

/**
 * Transcribe audio using OpenAI Whisper API
 */
async function transcribeAudio(
  audioBlob: Blob,
  language?: string
): Promise<{ text: string; language?: string }> {
  if (!config.openai.apiKey) {
    throw new Error("OPENAI_API_KEY not configured")
  }

  const formData = new FormData()
  
  // Whisper expects a file, convert blob to file
  const file = new File([audioBlob], 'audio.webm', { type: audioBlob.type })
  formData.append('file', file)
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'json')
  
  // If language is specified, tell Whisper to use it (improves accuracy)
  // Otherwise, Whisper will auto-detect
  if (language) {
    // Whisper uses ISO 639-1 codes
    const langCode = language === 'zh' ? 'zh' : language === 'en' ? 'en' : language
    formData.append('language', langCode)
  }

  log("INFO", "Transcribing audio with Whisper", {
    size: audioBlob.size,
    type: audioBlob.type,
    language: language || 'auto-detect'
  })

  const response = await fetch(`${OPENAI_API_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.openai.apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } })) as { error?: { message?: string } }
    log("ERROR", "Whisper API error", errorData)
    throw new Error(errorData.error?.message || "Failed to transcribe audio")
  }

  const result = await response.json() as { text?: string; language?: string }
  
  log("INFO", "Transcription completed", {
    textLength: result.text?.length || 0
  })

  return {
    text: result.text || '',
    language: result.language
  }
}

export const speechRoutes = {
  // POST /api/speech/transcribe - Transcribe audio to text using Whisper
  "/api/speech/transcribe": {
    POST: withAuth(async (req, user) => {
      try {
        const contentType = req.headers.get('content-type') || ''
        
        let audioBlob: Blob
        let language: string | undefined
        
        if (contentType.includes('multipart/form-data')) {
          // Handle multipart form data
          const formData = await req.formData()
          const audioFile = formData.get('audio')
          language = formData.get('language')?.toString()
          
          if (!audioFile || !(audioFile instanceof Blob)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'No audio file provided'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          
          audioBlob = audioFile
        } else {
          // Handle raw audio blob (for simpler frontend implementation)
          const buffer = await req.arrayBuffer()
          const mimeType = contentType.split(';')[0] || 'audio/webm'
          audioBlob = new Blob([buffer], { type: mimeType })
          
          // Get language from query param
          const url = new URL(req.url)
          language = url.searchParams.get('language') || undefined
        }
        
        // Validate file size
        if (audioBlob.size > MAX_FILE_SIZE) {
          return new Response(JSON.stringify({
            success: false,
            error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
          }), {
            status: 413,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        // Validate file type
        const mimeType = audioBlob.type.split(';')[0]
        if (mimeType && !SUPPORTED_FORMATS.includes(mimeType)) {
          log("WARN", "Unsupported audio format", { mimeType, supported: SUPPORTED_FORMATS })
          // Don't reject - Whisper might still handle it
        }
        
        // Validate audio has content
        if (audioBlob.size < 100) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Audio file is too small or empty'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        log("INFO", "Processing speech transcription", {
          userId: user.id,
          size: audioBlob.size,
          type: audioBlob.type,
          language
        })

        const result = await transcribeAudio(audioBlob, language)
        
        return new Response(JSON.stringify({
          success: true,
          text: result.text,
          language: result.language
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
        
      } catch (error) {
        log("ERROR", "Speech transcription error", {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to transcribe audio'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    })
  }
}
