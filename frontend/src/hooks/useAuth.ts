import { useState, useEffect, useCallback, useRef } from "react"

export interface User {
  id: number
  email: string
  name: string | null
  created_at: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface LoginCredentials {
  email: string
  password: string
}

interface RegisterCredentials {
  email: string
  password: string
  name?: string
}

interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
  expiresIn: number
  message: string
}

interface RefreshResponse {
  accessToken: string
  expiresIn: number
}

interface AuthError {
  error: string
}

const ACCESS_TOKEN_KEY = "promptink_access_token"
const REFRESH_TOKEN_KEY = "promptink_refresh_token"
const USER_KEY = "promptink_user"

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isLoading: true,
    isAuthenticated: false,
  })

  const refreshTimeoutRef = useRef<number | null>(null)
  const isRefreshingRef = useRef(false)

  // Clear auth state
  const clearAuth = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = null
    }

    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      isAuthenticated: false,
    })
  }, [])

  // Refresh access token
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) {
      return false
    }

    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) {
      clearAuth()
      return false
    }

    isRefreshingRef.current = true

    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      })

      const data: RefreshResponse | AuthError = await response.json()

      if (!response.ok || "error" in data) {
        clearAuth()
        return false
      }

      const refreshData = data as RefreshResponse
      localStorage.setItem(ACCESS_TOKEN_KEY, refreshData.accessToken)

      setState((prev) => ({
        ...prev,
        accessToken: refreshData.accessToken,
      }))

      // Schedule next refresh (refresh 1 minute before expiry)
      // Ensure minimum delay of 10 seconds to prevent negative timeout
      const refreshIn = Math.max((refreshData.expiresIn - 60) * 1000, 10000)
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      refreshTimeoutRef.current = window.setTimeout(() => {
        refreshAccessToken()
      }, refreshIn)

      return true
    } catch (error) {
      clearAuth()
      return false
    } finally {
      isRefreshingRef.current = false
    }
  }, [clearAuth])

  // Verify token with backend
  const verifyToken = useCallback(async (accessToken: string) => {
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        // Try to refresh token
        const refreshed = await refreshAccessToken()
        if (!refreshed) {
          clearAuth()
        }
        return false
      }

      const data = await response.json()
      setState((prev) => ({
        ...prev,
        user: data.user,
        isLoading: false,
        isAuthenticated: true,
      }))
      return true
    } catch {
      // Try to refresh token
      const refreshed = await refreshAccessToken()
      if (!refreshed) {
        clearAuth()
      }
      return false
    }
  }, [refreshAccessToken, clearAuth])

  // Initialize auth state from localStorage
  useEffect(() => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    const userStr = localStorage.getItem(USER_KEY)

    if (accessToken && refreshToken && userStr) {
      try {
        const user = JSON.parse(userStr) as User
        setState({
          user,
          accessToken,
          refreshToken,
          isLoading: false,
          isAuthenticated: true,
        })
        // Verify token is still valid
        verifyToken(accessToken)
      } catch {
        clearAuth()
      }
    } else {
      setState((prev) => ({ ...prev, isLoading: false }))
    }

    // Cleanup on unmount
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [clearAuth])

  // Login
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(credentials),
        })

        const data: AuthResponse | AuthError = await response.json()

        if (!response.ok || "error" in data) {
          return { success: false, error: (data as AuthError).error }
        }

        const authData = data as AuthResponse
        localStorage.setItem(ACCESS_TOKEN_KEY, authData.accessToken)
        localStorage.setItem(REFRESH_TOKEN_KEY, authData.refreshToken)
        localStorage.setItem(USER_KEY, JSON.stringify(authData.user))

        setState({
          user: authData.user,
          accessToken: authData.accessToken,
          refreshToken: authData.refreshToken,
          isLoading: false,
          isAuthenticated: true,
        })

        // Schedule token refresh (refresh 1 minute before expiry)
        // Ensure minimum delay of 10 seconds to prevent negative timeout
        const refreshIn = Math.max((authData.expiresIn - 60) * 1000, 10000)
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current)
        }
        refreshTimeoutRef.current = window.setTimeout(() => {
          refreshAccessToken()
        }, refreshIn)

        return { success: true }
      } catch (error) {
        return { success: false, error: "Login failed. Please try again." }
      }
    },
    [refreshAccessToken]
  )

  // Register
  const register = useCallback(
    async (credentials: RegisterCredentials): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(credentials),
        })

        const data: AuthResponse | AuthError = await response.json()

        if (!response.ok || "error" in data) {
          return { success: false, error: (data as AuthError).error }
        }

        const authData = data as AuthResponse
        localStorage.setItem(ACCESS_TOKEN_KEY, authData.accessToken)
        localStorage.setItem(REFRESH_TOKEN_KEY, authData.refreshToken)
        localStorage.setItem(USER_KEY, JSON.stringify(authData.user))

        setState({
          user: authData.user,
          accessToken: authData.accessToken,
          refreshToken: authData.refreshToken,
          isLoading: false,
          isAuthenticated: true,
        })

        // Schedule token refresh (refresh 1 minute before expiry)
        // Ensure minimum delay of 10 seconds to prevent negative timeout
        const refreshIn = Math.max((authData.expiresIn - 60) * 1000, 10000)
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current)
        }
        refreshTimeoutRef.current = window.setTimeout(() => {
          refreshAccessToken()
        }, refreshIn)

        return { success: true }
      } catch (error) {
        return { success: false, error: "Registration failed. Please try again." }
      }
    },
    [refreshAccessToken]
  )

  // Logout
  const logout = useCallback(async () => {
    try {
      if (state.accessToken && state.refreshToken) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${state.accessToken}`,
          },
          body: JSON.stringify({ refreshToken: state.refreshToken }),
        })
      }
    } catch {
      // Ignore logout errors
    } finally {
      clearAuth()
    }
  }, [state.accessToken, state.refreshToken, clearAuth])

  // Get auth header for API calls
  const getAuthHeader = useCallback(() => {
    if (state.accessToken) {
      return { Authorization: `Bearer ${state.accessToken}` }
    }
    return {}
  }, [state.accessToken])

  // Fetch with automatic token refresh on 401
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = {
        ...options.headers,
        ...getAuthHeader(),
      }

      let response = await fetch(url, { ...options, headers })

      // If unauthorized, try to refresh token and retry
      if (response.status === 401) {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          // Retry with new token
          const newHeaders = {
            ...options.headers,
            ...getAuthHeader(),
          }
          response = await fetch(url, { ...options, headers: newHeaders })
        }
      }

      return response
    },
    [getAuthHeader, refreshAccessToken]
  )

  return {
    user: state.user,
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    login,
    register,
    logout,
    getAuthHeader,
    authFetch,
    refreshAccessToken,
  }
}
