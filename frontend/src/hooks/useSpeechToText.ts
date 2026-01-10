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
}

const langMap: Record<Language, string> = {
  en: "en-US",
  zh: "zh-CN",
}

export function useSpeechToText(language: Language = "en"): UseSpeechToTextReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalTranscriptRef = useRef("")

  const isSupported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)

  const createRecognition = useCallback(() => {
    if (!isSupported) return null

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = langMap[language]

    recognition.onresult = (event) => {
      let interim = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript
          setTranscript(finalTranscriptRef.current)
        } else {
          interim += result[0].transcript
        }
      }

      setInterimTranscript(interim)
    }

    recognition.onstart = () => {
      console.log("Speech recognition started")
      setIsListening(true)
      setError(null)
    }

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error)
      setError(event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      console.log("Speech recognition ended")
      setIsListening(false)
      setInterimTranscript("")
    }

    return recognition
  }, [isSupported, language])

  // Stop listening and recreate recognition when language changes
  useEffect(() => {
    // Stop current recognition if active
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        // Ignore errors when stopping
      }
      recognitionRef.current = null
    }

    setIsListening(false)
    setInterimTranscript("")

    // Create new recognition with updated language
    recognitionRef.current = createRecognition()

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Ignore errors when stopping
        }
      }
    }
  }, [language, createRecognition])

  const startListening = useCallback(() => {
    // Always create fresh recognition with current language
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        // Ignore
      }
    }

    recognitionRef.current = createRecognition()
    if (!recognitionRef.current) return

    setError(null)
    setTranscript("")
    setInterimTranscript("")
    finalTranscriptRef.current = ""

    try {
      console.log("Starting speech recognition...")
      recognitionRef.current.start()
      // Note: isListening will be set to true by onstart event
    } catch (err) {
      console.error("Failed to start speech recognition:", err)
      setError("Failed to start speech recognition")
    }
  }, [createRecognition])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    try {
      recognitionRef.current.stop()
    } catch (e) {
      // Ignore
    }
    setIsListening(false)
    setInterimTranscript("")
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript("")
    setInterimTranscript("")
    finalTranscriptRef.current = ""
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
  }
}
