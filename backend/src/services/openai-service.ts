import { config } from "../config"
import { log } from "../utils"
import sharp from "sharp"

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
    const error = await response.json() as { error?: { message?: string } }
    log("ERROR", "Translation API error", error)
    throw new Error(error.error?.message || "Failed to translate text")
  }

  const result = await response.json() as { choices?: { message?: { content?: string } }[] }
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
    const error = await response.json() as { error?: { message?: string } }
    log("ERROR", "OpenAI API error", error)
    throw new Error(error.error?.message || "Failed to generate image")
  }

  const result = await response.json() as ImageGenerationResponse
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

  // Convert image to RGBA PNG format (required by DALL-E 2 edit API)
  const rgbaImage = await sharp(Buffer.from(image))
    .ensureAlpha()
    .png()
    .toBuffer()

  const formData = new FormData()
  formData.append("image", new Blob([rgbaImage], { type: "image/png" }), "image.png")
  formData.append("prompt", prompt)
  formData.append("model", "dall-e-2")

  if (options?.mask) {
    // Convert mask to RGBA PNG format as well
    const rgbaMask = await sharp(Buffer.from(options.mask))
      .ensureAlpha()
      .png()
      .toBuffer()
    formData.append("mask", new Blob([rgbaMask], { type: "image/png" }), "mask.png")
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
    const error = await response.json() as { error?: { message?: string } }
    log("ERROR", "OpenAI API error", error)
    throw new Error(error.error?.message || "Failed to edit image")
  }

  return await response.json() as ImageGenerationResponse
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

  // Convert image to RGBA PNG format (required by DALL-E 2 variations API)
  const rgbaImage = await sharp(Buffer.from(image))
    .ensureAlpha()
    .png()
    .toBuffer()

  const formData = new FormData()
  formData.append("image", new Blob([rgbaImage], { type: "image/png" }), "image.png")
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
    const error = await response.json() as { error?: { message?: string } }
    log("ERROR", "OpenAI API error", error)
    throw new Error(error.error?.message || "Failed to create image variation")
  }

  return await response.json() as ImageGenerationResponse
}

/**
 * Analyze markdown/text content and generate an infographic prompt
 */
export async function generateInfographicPrompt(content: string): Promise<string> {
  if (!config.openai.apiKey) {
    throw new Error("OPENAI_API_KEY not configured")
  }

  log("INFO", "Analyzing content for infographic", { contentLength: content.length })

  const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.openai.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at creating visual infographic descriptions for DALL-E image generation.

Analyze the provided content (text, markdown, or documentation) and create a detailed image generation prompt for a beautiful, professional presentation-style infographic.

Guidelines:
- Create a visually striking infographic that captures the KEY concepts
- Use modern design aesthetics: clean layouts, bold typography style, color gradients
- Include visual metaphors and icons to represent abstract concepts
- Design for a professional presentation or social media share
- Focus on 3-5 main points maximum for clarity
- Specify colors, layout structure, and visual hierarchy
- The prompt should be detailed enough for DALL-E to create a cohesive design

Output ONLY the image generation prompt, nothing else. Start directly with the visual description.`,
        },
        {
          role: "user",
          content: `Create an infographic prompt for this content:\n\n${content.substring(0, 8000)}`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.json() as { error?: { message?: string } }
    log("ERROR", "GPT API error for infographic", error)
    throw new Error(error.error?.message || "Failed to analyze content")
  }

  const result = await response.json() as { choices?: { message?: { content?: string } }[] }
  const infographicPrompt = result.choices?.[0]?.message?.content?.trim()

  if (!infographicPrompt) {
    throw new Error("Failed to generate infographic prompt")
  }

  log("INFO", "Generated infographic prompt", { promptLength: infographicPrompt.length })

  return infographicPrompt
}

/**
 * Fetch content from a URL (GitHub markdown, etc.)
 */
export async function fetchUrlContent(url: string): Promise<string> {
  // Convert GitHub blob URLs to raw URLs
  let fetchUrl = url
  if (url.includes("github.com") && url.includes("/blob/")) {
    fetchUrl = url
      .replace("github.com", "raw.githubusercontent.com")
      .replace("/blob/", "/")
  }

  log("INFO", "Fetching URL content", { originalUrl: url, fetchUrl })

  const response = await fetch(fetchUrl, {
    headers: {
      "Accept": "text/plain, text/markdown, */*",
      "User-Agent": "PromptInk/1.0",
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
  }

  const content = await response.text()
  log("INFO", "Fetched URL content", { contentLength: content.length })

  return content
}
