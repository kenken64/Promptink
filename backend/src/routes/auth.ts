import { registerUser, loginUser, refreshAccessToken, revokeToken, revokeAllUserTokens, verifyToken } from "../services/auth-service"
import { withAuth } from "../middleware/auth"
import { log } from "../utils"

// Helper to extract IP and User-Agent from request
function getClientInfo(req: Request) {
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
                   req.headers.get("x-real-ip") ||
                   "unknown"
  const userAgent = req.headers.get("user-agent") || "unknown"
  return { ipAddress, userAgent }
}

export const authRoutes = {
  // Register new user
  "/api/auth/register": {
    POST: async (req: Request) => {
      try {
        const text = await req.text()
        const { email, password, name } = text ? JSON.parse(text) : {}

        if (!email || !password) {
          return Response.json(
            { error: "Email and password are required" },
            { status: 400 }
          )
        }

        const { ipAddress, userAgent } = getClientInfo(req)
        const result = await registerUser(email, password, name, ipAddress, userAgent)

        if ("error" in result) {
          return Response.json({ error: result.error }, { status: 400 })
        }

        return Response.json({
          message: "Registration successful",
          user: result.user,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresIn: result.tokens.expiresIn,
        })
      } catch (error) {
        log("ERROR", "Registration error", error)
        return Response.json({ error: "Registration failed" }, { status: 500 })
      }
    },
  },

  // Login user
  "/api/auth/login": {
    POST: async (req: Request) => {
      try {
        const text = await req.text()
        const { email, password } = text ? JSON.parse(text) : {}

        log("INFO", "Login attempt", { email, hasPassword: !!password })

        if (!email || !password) {
          log("WARN", "Login missing credentials", { email, hasPassword: !!password })
          return Response.json(
            { error: "Email and password are required" },
            { status: 400 }
          )
        }

        const { ipAddress, userAgent } = getClientInfo(req)
        const result = await loginUser(email, password, ipAddress, userAgent)

        if ("error" in result) {
          log("WARN", "Login failed", { email, error: result.error })
          return Response.json({ error: result.error }, { status: 401 })
        }

        log("INFO", "Login successful", { email, userId: result.user.id })
        return Response.json({
          message: "Login successful",
          user: result.user,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresIn: result.tokens.expiresIn,
        })
      } catch (error) {
        log("ERROR", "Login error", error)
        return Response.json({ error: "Login failed" }, { status: 500 })
      }
    },
  },

  // Refresh access token
  "/api/auth/refresh": {
    POST: async (req: Request) => {
      try {
        const text = await req.text()
        const { refreshToken } = text ? JSON.parse(text) : {}

        if (!refreshToken) {
          return Response.json(
            { error: "Refresh token is required" },
            { status: 400 }
          )
        }

        const result = await refreshAccessToken(refreshToken)

        if ("error" in result) {
          return Response.json({ error: result.error }, { status: 401 })
        }

        return Response.json({
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        })
      } catch (error) {
        log("ERROR", "Token refresh error", error)
        return Response.json({ error: "Token refresh failed" }, { status: 500 })
      }
    },
  },

  // Get current user (protected)
  "/api/auth/me": {
    GET: withAuth(async (req, user) => {
      return Response.json({ user })
    }),
  },

  // Logout (revoke current token)
  "/api/auth/logout": {
    POST: withAuth(async (req, user, payload) => {
      // Revoke the current access token
      if (payload && payload.jti) {
        revokeToken(payload.jti, user.id, payload.exp, "user logout")
      }

      // Optionally revoke refresh token if provided
      try {
        const text = await req.text()
        const { refreshToken } = text ? JSON.parse(text) : {}

        if (refreshToken) {
          const refreshPayload = await verifyToken(refreshToken, "refresh")
          if (refreshPayload && refreshPayload.jti) {
            revokeToken(refreshPayload.jti, user.id, refreshPayload.exp, "user logout")
          }
        }
      } catch (error) {
        // Ignore errors in refresh token revocation
      }

      log("INFO", "User logged out", { userId: user.id })
      return Response.json({ message: "Logged out successfully" })
    }),
  },

  // Logout from all devices (revoke all tokens)
  "/api/auth/logout-all": {
    POST: withAuth(async (req, user, payload) => {
      // Revoke current access token
      if (payload && payload.jti) {
        revokeToken(payload.jti, user.id, payload.exp, "logout all devices")
      }

      // Revoke all refresh tokens
      revokeAllUserTokens(user.id)

      log("INFO", "User logged out from all devices", { userId: user.id })
      return Response.json({ message: "Logged out from all devices successfully" })
    }),
  },
}
