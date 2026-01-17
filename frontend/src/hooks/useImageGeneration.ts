import { useState } from "react"
import type { Language } from "./useLanguage"

interface GeneratedImage {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

interface ImageGenerationResponse {
  created: number
  data: GeneratedImage[]
}

interface AuthHeaders {
  Authorization?: string
}

interface GenerateImageOptions {
  prompt: string
  language?: Language
  authHeaders?: AuthHeaders
  size?: "1024x1024" | "1792x1024" | "1024x1792"
}

interface UseImageGenerationReturn {
  generateImage: (options: GenerateImageOptions) => Promise<ImageGenerationResponse>
  isLoading: boolean
  error: string | null
}

export function useImageGeneration(): UseImageGenerationReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateImage = async ({ prompt, language, authHeaders, size = "1024x1024" }: GenerateImageOptions): Promise<ImageGenerationResponse> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          prompt,
          language,
          model: "dall-e-3",
          size,
          quality: "standard",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate image")
      }

      const data = await response.json()
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred"
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return { generateImage, isLoading, error }
}
