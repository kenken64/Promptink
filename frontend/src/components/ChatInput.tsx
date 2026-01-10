import { useState, useEffect, useRef, KeyboardEvent } from "react"
import { Mic, MicOff, ArrowUp, ImageIcon } from "lucide-react"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { useSpeechToText } from "../hooks/useSpeechToText"
import { cn } from "../lib/utils"
import type { Language } from "../hooks/useLanguage"

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  language: Language
  placeholder: string
  placeholderListening: string
  footer: string
}

export function ChatInput({
  onSend,
  disabled,
  language,
  placeholder,
  placeholderListening,
  footer,
}: ChatInputProps) {
  const [input, setInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const baseInputRef = useRef("")
  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error: speechError,
  } = useSpeechToText(language)

  // Update input when final transcript changes
  useEffect(() => {
    if (transcript) {
      const separator = language === "en" && baseInputRef.current && !baseInputRef.current.endsWith(" ") ? " " : ""
      setInput(baseInputRef.current + separator + transcript)
    }
  }, [transcript, language])

  // Show interim results in real-time
  const displayValue = isListening && interimTranscript
    ? input + (language === "en" && input && !input.endsWith(" ") ? " " : "") + interimTranscript
    : input

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [displayValue])

  const handleSubmit = () => {
    const textToSend = input.trim()
    if (textToSend && !disabled) {
      onSend(textToSend)
      setInput("")
      baseInputRef.current = ""
      resetTranscript()
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleMicClick = () => {
    if (isListening) {
      stopListening()
      // After stopping, update baseInputRef with current input
      baseInputRef.current = input
    } else {
      // Save current input as base before starting
      baseInputRef.current = input
      resetTranscript()
      startListening()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setInput(newValue)
    if (!isListening) {
      baseInputRef.current = newValue
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-2 sm:px-4 pb-2 sm:pb-4">
      <div className={cn(
        "relative flex items-end gap-1 sm:gap-2 rounded-2xl border bg-secondary/50 p-1.5 sm:p-2 shadow-sm transition-all",
        isListening && "border-red-500 ring-2 ring-red-500/20"
      )}>
        <Textarea
          ref={textareaRef}
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? placeholderListening : placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 min-h-[44px] max-h-[120px] sm:max-h-[200px] bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none py-3 px-2 text-base sm:text-sm",
            isListening && "placeholder:text-red-500"
          )}
        />

        <div className="flex items-center gap-1 pr-0.5 sm:pr-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-9 sm:w-9 rounded-full shrink-0 touch-manipulation text-muted-foreground hover:text-foreground"
            aria-label="Attach image"
          >
            <ImageIcon className="h-5 w-5 sm:h-4 sm:w-4" />
          </Button>

          {isSupported && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleMicClick}
              disabled={disabled}
              className={cn(
                "h-10 w-10 sm:h-9 sm:w-9 rounded-full shrink-0 touch-manipulation",
                isListening && "bg-red-500 text-white hover:bg-red-600 hover:text-white"
              )}
              aria-label={isListening ? "Stop recording" : "Start recording"}
            >
              {isListening ? (
                <MicOff className="h-5 w-5 sm:h-4 sm:w-4" />
              ) : (
                <Mic className="h-5 w-5 sm:h-4 sm:w-4" />
              )}
            </Button>
          )}

          <Button
            type="button"
            size="icon"
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
            className={cn(
              "h-10 w-10 sm:h-9 sm:w-9 rounded-full transition-all shrink-0 touch-manipulation",
              input.trim()
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-muted text-muted-foreground"
            )}
            aria-label="Send message"
          >
            <ArrowUp className="h-5 w-5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>

      {speechError && (
        <p className="text-[10px] sm:text-xs text-center text-red-500 mt-1.5 sm:mt-2 px-2">
          Mic error: {speechError}
        </p>
      )}

      <p className="text-[10px] sm:text-xs text-center text-muted-foreground mt-1.5 sm:mt-2 px-2 hidden sm:block">
        {footer}
      </p>
    </div>
  )
}
