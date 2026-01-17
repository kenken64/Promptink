import { useState, useEffect, useCallback } from "react"

interface SuggestionsState {
  suggestions: string[]
  isLoading: boolean
  error: string | null
}

export function useSuggestions(language: "en" | "zh") {
  const [state, setState] = useState<SuggestionsState>({
    suggestions: [],
    isLoading: true,
    error: null,
  })

  const fetchSuggestions = useCallback(async (forceRefresh = false) => {
    setState((prev: SuggestionsState) => ({ ...prev, isLoading: true, error: null }))
    
    try {
      const endpoint = forceRefresh ? "/api/suggestions/refresh" : "/api/suggestions"
      const response = await fetch(`${endpoint}?lang=${language}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch suggestions")
      }
      
      const data = await response.json()
      setState({
        suggestions: data.suggestions || [],
        isLoading: false,
        error: null,
      })
    } catch (error) {
      setState((prev: SuggestionsState) => ({
        ...prev,
        isLoading: false,
        error: String(error),
      }))
    }
  }, [language])

  // Fetch suggestions on mount and when language changes
  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  const refresh = useCallback(() => {
    fetchSuggestions(true)
  }, [fetchSuggestions])

  return {
    suggestions: state.suggestions,
    isLoading: state.isLoading,
    error: state.error,
    refresh,
  }
}
