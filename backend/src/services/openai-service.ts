import { config } from "../config"
import { log } from "../utils"

const OPENAI_API_BASE = "https://api.openai.com/v1"

// Translate text using OpenAI Chat API
export async function translateText(
  text: string,
  targetLanguage: "zh" | "en"
): Promise<string> {
  if (!config.openai.apiKey) {
    throw new Error("OPENAI_API_KEY not configured")
  }

  const languageName = targetLanguage === "zh" ? "Chinese (Simplified)" : "English"

  log("INFO", "Translating text", { targetLanguage, textLength: text.length })

  const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.openai.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a translator. Translate the following text to ${languageName}. Only return the translated text, nothing else.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    log("ERROR", "Translation API error", error)
    throw new Error(error.error?.message || "Failed to translate text")
  }

  const result = await response.json()
  const translatedText = result.choices?.[0]?.message?.content?.trim() || text

  log("INFO", "Translation completed", { originalLength: text.length, translatedLength: translatedText.length })

  return translatedText
}

export type ImageSize = "1024x1024" | "1024x1792" | "1792x1024" | "256x256" | "512x512"
export type ImageModel = "dall-e-2" | "dall-e-3"
export type ImageQuality = "standard" | "hd"
export type ImageStyle = "vivid" | "natural"
export type ResponseFormat = "url" | "b64_json"

export interface GenerateImageOptions {
  prompt: string
  model?: ImageModel
  n?: number
  size?: ImageSize
  quality?: ImageQuality
  style?: ImageStyle
  response_format?: ResponseFormat
}

export interface GeneratedImage {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export interface ImageGenerationResponse {
  created: number
  data: GeneratedImage[]
}

export async function generateImage(options: GenerateImageOptions): Promise<ImageGenerationResponse> {
  const {
    prompt,
    model = "dall-e-3",
    n = 1,
    size = "1024x1024",
    quality = "standard",
    style = "vivid",
    response_format = "url",
  } = options

  if (!config.openai.apiKey) {
    throw new Error("OPENAI_API_KEY not configured")
  }

  log("INFO", "Generating image", { prompt, model, size, quality, style })

  const response = await fetch(`${OPENAI_API_BASE}/images/generations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.openai.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      model,
      n,
      size,
      quality,
      style,
      response_format,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    log("ERROR", "OpenAI API error", error)
    throw new Error(error.error?.message || "Failed to generate image")
  }

  const result = await response.json()
  log("INFO", "Image generated successfully", { created: result.created, count: result.data.length })

  return result
}

export async function generateImageEdit(
  image: ArrayBuffer,
  prompt: string,
  options?: {
    mask?: ArrayBuffer
    n?: number
    size?: ImageSize
    response_format?: ResponseFormat
  }
): Promise<ImageGenerationResponse> {
  if (!config.openai.apiKey) {
    throw new Error("OPENAI_API_KEY not configured")
  }

  log("INFO", "Editing image", { prompt, size: options?.size })

  const formData = new FormData()
  formData.append("image", new Blob([image], { type: "image/png" }), "image.png")
  formData.append("prompt", prompt)
  formData.append("model", "dall-e-2")

  if (options?.mask) {
    formData.append("mask", new Blob([options.mask], { type: "image/png" }), "mask.png")
  }
  if (options?.n) {
    formData.append("n", String(options.n))
  }
  if (options?.size) {
    formData.append("size", options.size)
  }
  if (options?.response_format) {
    formData.append("response_format", options.response_format)
  }

  const response = await fetch(`${OPENAI_API_BASE}/images/edits`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.openai.apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    log("ERROR", "OpenAI API error", error)
    throw new Error(error.error?.message || "Failed to edit image")
  }

  return response.json()
}

export async function generateImageVariation(
  image: ArrayBuffer,
  options?: {
    n?: number
    size?: ImageSize
    response_format?: ResponseFormat
  }
): Promise<ImageGenerationResponse> {
  if (!config.openai.apiKey) {
    throw new Error("OPENAI_API_KEY not configured")
  }

  log("INFO", "Creating image variation", { size: options?.size })

  const formData = new FormData()
  formData.append("image", new Blob([image], { type: "image/png" }), "image.png")
  formData.append("model", "dall-e-2")

  if (options?.n) {
    formData.append("n", String(options.n))
  }
  if (options?.size) {
    formData.append("size", options.size)
  }
  if (options?.response_format) {
    formData.append("response_format", options.response_format)
  }

  const response = await fetch(`${OPENAI_API_BASE}/images/variations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.openai.apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    log("ERROR", "OpenAI API error", error)
    throw new Error(error.error?.message || "Failed to create image variation")
  }

  return response.json()
}
