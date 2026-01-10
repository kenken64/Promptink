import { useState, useEffect, useCallback } from "react"

export interface User {
  id: number
  email: string
  name: string | null
  created_at: string
}

interface AuthState {
  user: User | null
  token: string | null
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
  token: string
  message: string
}

interface AuthError {
  error: string
}

const TOKEN_KEY = "promptink_token"
const USER_KEY = "promptink_user"

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  })

  // Initialize auth state from localStorage
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    const userStr = localStorage.getItem(USER_KEY)

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User
        setState({
          user,
          token,
          isLoading: false,
          isAuthenticated: true,
        })
        // Verify token is still valid
        verifyToken(token)
      } catch {
        clearAuth()
      }
    } else {
      setState((prev) => ({ ...prev, isLoading: false }))
    }
  }, [])

  // Verify token with backend
  const verifyToken = async (token: string) => {
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        clearAuth()
        return false
      }

      const data = await response.json()
      setState({
        user: data.user,
        token,
        isLoading: false,
        isAuthenticated: true,
      })
      return true
    } catch {
      clearAuth()
      return false
    }
  }

  // Clear auth state
  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    })
  }, [])

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
        localStorage.setItem(TOKEN_KEY, authData.token)
        localStorage.setItem(USER_KEY, JSON.stringify(authData.user))

        setState({
          user: authData.user,
          token: authData.token,
          isLoading: false,
          isAuthenticated: true,
        })

        return { success: true }
      } catch (error) {
        return { success: false, error: "Login failed. Please try again." }
      }
    },
    []
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
        localStorage.setItem(TOKEN_KEY, authData.token)
        localStorage.setItem(USER_KEY, JSON.stringify(authData.user))

        setState({
          user: authData.user,
          token: authData.token,
          isLoading: false,
          isAuthenticated: true,
        })

        return { success: true }
      } catch (error) {
        return { success: false, error: "Registration failed. Please try again." }
      }
    },
    []
  )

  // Logout
  const logout = useCallback(async () => {
    try {
      if (state.token) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${state.token}`,
          },
        })
      }
    } catch {
      // Ignore logout errors
    } finally {
      clearAuth()
    }
  }, [state.token, clearAuth])

  // Get auth header for API calls
  const getAuthHeader = useCallback(() => {
    if (state.token) {
      return { Authorization: `Bearer ${state.token}` }
    }
    return {}
  }, [state.token])

  return {
    user: state.user,
    token: state.token,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    login,
    register,
    logout,
    getAuthHeader,
  }
}
