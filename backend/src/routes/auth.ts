import { registerUser, loginUser } from "../services/auth-service"
import { withAuth } from "../middleware/auth"
import { log } from "../utils"

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

        const result = await registerUser(email, password, name)

        if ("error" in result) {
          return Response.json({ error: result.error }, { status: 400 })
        }

        return Response.json({
          message: "Registration successful",
          user: result.user,
          token: result.token,
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

        if (!email || !password) {
          return Response.json(
            { error: "Email and password are required" },
            { status: 400 }
          )
        }

        const result = await loginUser(email, password)

        if ("error" in result) {
          return Response.json({ error: result.error }, { status: 401 })
        }

        return Response.json({
          message: "Login successful",
          user: result.user,
          token: result.token,
        })
      } catch (error) {
        log("ERROR", "Login error", error)
        return Response.json({ error: "Login failed" }, { status: 500 })
      }
    },
  },

  // Get current user (protected)
  "/api/auth/me": {
    GET: withAuth(async (req, user) => {
      return Response.json({ user })
    }),
  },

  // Logout (client-side token removal, but can be used for session invalidation)
  "/api/auth/logout": {
    POST: withAuth(async (req, user) => {
      // In a more complex system, you might invalidate the token here
      log("INFO", "User logged out", { userId: user.id })
      return Response.json({ message: "Logged out successfully" })
    }),
  },
}
