import { useState, useEffect, useRef, useCallback } from "react"
import type { Language } from "./useLanguage"

interface UseSpeechToTextReturn {
  isListening: boolean
  transcript: string
  interimTranscript: string
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
  isSupported: boolean
  error: string | null
  isProcessing: boolean  // New: indicates Whisper is processing
}

// MediaRecorder MIME types in order of preference
const AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
]

function getSupportedMimeType(): string {
  for (const mimeType of AUDIO_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType
    }
  }
  return 'audio/webm' // Fallback
}

export function useSpeechToText(language: Language = "en"): UseSpeechToTextReturn {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Check if MediaRecorder is supported (for Whisper)
  const isSupported = typeof window !== "undefined" && 
    typeof MediaRecorder !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined"

  /**
   * Send audio to backend for Whisper transcription
   */
  const transcribeWithWhisper = useCallback(async (audioBlob: Blob): Promise<string> => {
    const token = localStorage.getItem('token')
    if (!token) {
      throw new Error('Not authenticated')
    }

    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')
    formData.append('language', language)

    const response = await fetch('/api/speech/transcribe', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Transcription failed')
    }

    return result.text || ''
  }, [language])

  /**
   * Start recording audio
   */
  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError('Speech recognition not supported in this browser')
      return
    }

    setError(null)
    setTranscript("")
    setInterimTranscript("Listening...")
    audioChunksRef.current = []

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Whisper prefers 16kHz
        } 
      })
      streamRef.current = stream

      const mimeType = getSupportedMimeType()
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 64000 // Lower bitrate for speech
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstart = () => {
        console.log("Recording started")
        setIsListening(true)
      }

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event)
        setError("Recording failed")
        setIsListening(false)
        setInterimTranscript("")
      }

      mediaRecorder.onstop = async () => {
        console.log("Recording stopped, processing...")
        setIsListening(false)
        setInterimTranscript("Processing...")
        setIsProcessing(true)

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }

        // Combine audio chunks
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        audioChunksRef.current = []

        // Skip if no audio recorded
        if (audioBlob.size < 100) {
          setInterimTranscript("")
          setIsProcessing(false)
          setError("No audio recorded")
          return
        }

        try {
          const text = await transcribeWithWhisper(audioBlob)
          setTranscript(text)
          setInterimTranscript("")
        } catch (err) {
          console.error("Transcription error:", err)
          setError(err instanceof Error ? err.message : "Transcription failed")
          setInterimTranscript("")
        } finally {
          setIsProcessing(false)
        }
      }

      // Start recording - collect data every 250ms
      mediaRecorder.start(250)
    } catch (err) {
      console.error("Failed to start recording:", err)
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError("Microphone permission denied")
      } else {
        setError("Failed to access microphone")
      }
      setInterimTranscript("")
    }
  }, [isSupported, transcribeWithWhisper])

  /**
   * Stop recording and trigger transcription
   */
  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    // Note: transcription happens in onstop handler
  }, [])

  /**
   * Reset transcript state
   */
  const resetTranscript = useCallback(() => {
    setTranscript("")
    setInterimTranscript("")
    setError(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error,
    isProcessing,
  }
}
