import { config } from "../config"
import { log } from "../utils"

const OPENAI_API_BASE = "https://api.openai.com/v1"

// Simple in-memory cache for suggestions
interface CacheEntry {
  suggestions: string[]
  timestamp: number
}

const cache: Map<string, CacheEntry> = new Map()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes - suggestions don't need to be fresh

async function generateSuggestions(language: "en" | "zh"): Promise<string[]> {
  if (!config.openai.apiKey) {
    throw new Error("OPENAI_API_KEY not configured")
  }

  const systemPrompt = language === "zh"
    ? `你是一个创意图像提示生成器。生成4个独特、富有创意的DALL-E图像提示建议。
要求：
- 每个提示10-20个中文字
- 风格多样：风景、奇幻、科幻、温馨场景、抽象艺术等
- 富有想象力和视觉冲击力
- 只返回4个提示，每行一个，不要编号或其他格式`
    : `You are a creative image prompt generator. Generate 4 unique, imaginative DALL-E image prompt suggestions.
Requirements:
- Each prompt should be 8-15 words
- Diverse styles: landscapes, fantasy, sci-fi, cozy scenes, abstract art, etc.
- Imaginative and visually striking
- Return only 4 prompts, one per line, no numbering or formatting`

  log("INFO", "Generating suggestions", { language })

  const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.openai.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate 4 creative image prompts now." },
      ],
      max_tokens: 300,
      temperature: 1.0, // Higher temperature for more variety
    }),
  })

  if (!response.ok) {
    const error = await response.json() as { error?: { message?: string } }
    log("ERROR", "Suggestions API error", error)
    throw new Error(error.error?.message || "Failed to generate suggestions")
  }

  const result = await response.json() as { choices?: { message?: { content?: string } }[] }
  const content = result.choices?.[0]?.message?.content?.trim() || ""
  
  // Parse the response - split by newlines and filter empty lines
  const suggestions = content
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .slice(0, 4) // Ensure max 4 suggestions

  log("INFO", "Generated suggestions", { count: suggestions.length, language })

  return suggestions
}

export const suggestionsRoutes = {
  "/api/suggestions": {
    GET: async (req: Request) => {
      try {
        const url = new URL(req.url)
        const lang = (url.searchParams.get("lang") || "en") as "en" | "zh"
        
        // Check cache first
        const cacheKey = `suggestions_${lang}`
        const cached = cache.get(cacheKey)
        
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          log("INFO", "Returning cached suggestions", { lang })
          return Response.json({ suggestions: cached.suggestions, cached: true })
        }

        // Generate new suggestions
        const suggestions = await generateSuggestions(lang)
        
        // Cache the result
        cache.set(cacheKey, {
          suggestions,
          timestamp: Date.now(),
        })

        return Response.json({ suggestions, cached: false })
      } catch (error) {
        log("ERROR", "Failed to generate suggestions", error)
        
        // Return fallback suggestions on error
        const url = new URL(req.url)
        const lang = url.searchParams.get("lang") || "en"
        
        const fallback = lang === "zh"
          ? [
              "夕阳下宁静的日式庭园，樱花盛开",
              "未来城市，飞行汽车穿梭，霓虹灯闪烁",
              "冬日山间温馨的小木屋",
              "海底宫殿，生物发光的奇幻生物环绕",
            ]
          : [
              "A serene Japanese garden with cherry blossoms at sunset",
              "A futuristic city with flying cars and neon lights",
              "A cozy cabin in the mountains during winter",
              "An underwater palace with bioluminescent creatures",
            ]
        
        return Response.json({ suggestions: fallback, cached: false, fallback: true })
      }
    },
  },

  // Force refresh suggestions (bypasses cache)
  "/api/suggestions/refresh": {
    GET: async (req: Request) => {
      try {
        const url = new URL(req.url)
        const lang = (url.searchParams.get("lang") || "en") as "en" | "zh"
        
        // Generate new suggestions (skip cache)
        const suggestions = await generateSuggestions(lang)
        
        // Update cache
        const cacheKey = `suggestions_${lang}`
        cache.set(cacheKey, {
          suggestions,
          timestamp: Date.now(),
        })

        return Response.json({ suggestions, cached: false })
      } catch (error) {
        log("ERROR", "Failed to refresh suggestions", error)
        return Response.json({ error: String(error) }, { status: 500 })
      }
    },
  },
}
