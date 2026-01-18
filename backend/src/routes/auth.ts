import { registerUser, loginUser, refreshAccessToken, revokeToken, revokeAllUserTokens, verifyToken, hashPassword, verifyPassword } from "../services/auth-service"
import { withAuth } from "../middleware/auth"
import { log } from "../utils"
import { userQueries, passwordResetTokenQueries } from "../db"
import { sendPasswordResetEmail, sendPasswordChangeConfirmation } from "../services/email-service"

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
            // Blacklist the specific refresh token JTI
            revokeToken(refreshPayload.jti, user.id, refreshPayload.exp, "user logout")

            // Also revoke the refresh token in the database to keep state consistent
            const { refreshTokenQueries } = await import("../db")
            const storedToken = refreshTokenQueries.findByJti.get(refreshPayload.jti)
            if (storedToken) {
              refreshTokenQueries.revoke.run(storedToken.id)
            }
          }
        }
      } catch (error) {
        // Ignore errors in refresh token revocation
      }

      log("INFO", "User logged out", { userId: user.id })
      return Response.json({ message: "Logged out successfully" })
    }),
  },

  // Forgot password - send reset email (public)
  "/api/auth/forgot-password": {
    POST: async (req: Request) => {
      try {
        const text = await req.text()
        const { email } = text ? JSON.parse(text) : {}

        if (!email) {
          return Response.json(
            { error: "Email is required" },
            { status: 400 }
          )
        }

        log("INFO", "Password reset requested", { email })

        // Find user by email
        const user = userQueries.findByEmail.get(email)

        // Always return success to prevent email enumeration
        if (!user) {
          log("WARN", "Password reset requested for non-existent email", { email })
          return Response.json({
            message: "If an account exists with this email, a password reset link has been sent.",
          })
        }

        // Generate secure random token
        const tokenBytes = new Uint8Array(32)
        crypto.getRandomValues(tokenBytes)
        const token = Array.from(tokenBytes)
          .map(b => b.toString(16).padStart(2, "0"))
          .join("")

        // Token expires in 1 hour
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

        // Delete any existing tokens for this user
        passwordResetTokenQueries.deleteByUserId.run(user.id)

        // Create new reset token
        passwordResetTokenQueries.create.get(user.id, token, expiresAt)

        // Send reset email
        const emailSent = await sendPasswordResetEmail(email, token, user.name || undefined)

        if (!emailSent) {
          log("ERROR", "Failed to send password reset email", { email })
          return Response.json(
            { error: "Failed to send reset email. Please try again later." },
            { status: 500 }
          )
        }

        log("INFO", "Password reset email sent", { email, userId: user.id })
        return Response.json({
          message: "If an account exists with this email, a password reset link has been sent.",
        })
      } catch (error) {
        log("ERROR", "Forgot password error", error)
        return Response.json(
          { error: "Failed to process password reset request" },
          { status: 500 }
        )
      }
    },
  },

  // Reset password with token (public)
  "/api/auth/reset-password": {
    POST: async (req: Request) => {
      try {
        const text = await req.text()
        const { token, newPassword } = text ? JSON.parse(text) : {}

        if (!token || !newPassword) {
          return Response.json(
            { error: "Token and new password are required" },
            { status: 400 }
          )
        }

        if (newPassword.length < 8) {
          return Response.json(
            { error: "Password must be at least 8 characters long" },
            { status: 400 }
          )
        }

        log("INFO", "Password reset attempt with token")

        // Find valid token
        const resetToken = passwordResetTokenQueries.findByToken.get(token)

        if (!resetToken) {
          log("WARN", "Invalid or expired reset token used")
          return Response.json(
            { error: "Invalid or expired reset token" },
            { status: 400 }
          )
        }

        // Get user
        const user = userQueries.findById.get(resetToken.user_id)

        if (!user) {
          log("ERROR", "User not found for valid reset token", { userId: resetToken.user_id })
          return Response.json(
            { error: "User not found" },
            { status: 404 }
          )
        }

        // Hash new password
        const passwordHash = await hashPassword(newPassword)

        // Update password
        userQueries.updatePassword.run(passwordHash, user.id)

        // Mark token as used
        passwordResetTokenQueries.markAsUsed.run(resetToken.id)

        // Send confirmation email
        try {
          await sendPasswordChangeConfirmation(user.email, user.name || undefined)
          log("INFO", "Password reset successful", { email: user.email, userId: user.id })
          return Response.json({
            message: "Password has been reset successfully. You can now log in with your new password.",
          })
        } catch (emailError) {
          log("ERROR", "Failed to send password reset confirmation email", {
            userId: user.id,
            email: user.email,
            error: emailError,
          })
          return Response.json({
            message: "Password has been reset successfully, but we were unable to send a confirmation email.",
            emailNotification: "failed",
          })
        }
      } catch (error) {
        log("ERROR", "Reset password error", error)
        return Response.json(
          { error: "Failed to reset password" },
          { status: 500 }
        )
      }
    },
  },

  // Change password (authenticated)
  "/api/auth/change-password": {
    POST: withAuth(async (req, user) => {
      try {
        const text = await req.text()
        const { currentPassword, newPassword } = text ? JSON.parse(text) : {}

        if (!currentPassword || !newPassword) {
          return Response.json(
            { error: "Current password and new password are required" },
            { status: 400 }
          )
        }

        if (newPassword.length < 8) {
          return Response.json(
            { error: "New password must be at least 8 characters long" },
            { status: 400 }
          )
        }

        log("INFO", "Password change attempt", { userId: user.id, email: user.email })

        // Get full user data (including password hash)
        const fullUser = userQueries.findById.get(user.id)

        if (!fullUser) {
          log("ERROR", "User not found during password change", { userId: user.id })
          return Response.json(
            { error: "User not found" },
            { status: 404 }
          )
        }

        // Verify current password
        const isValidPassword = await verifyPassword(currentPassword, fullUser.password_hash)

        if (!isValidPassword) {
          log("WARN", "Invalid current password during password change", { userId: user.id })
          return Response.json(
            { error: "Current password is incorrect" },
            { status: 401 }
          )
        }

        // Check if new password is different from current
        const isSamePassword = await verifyPassword(newPassword, fullUser.password_hash)
        if (isSamePassword) {
          return Response.json(
            { error: "New password must be different from current password" },
            { status: 400 }
          )
        }

        // Hash new password
        const passwordHash = await hashPassword(newPassword)

        // Update password
        userQueries.updatePassword.run(passwordHash, user.id)

        // Send confirmation email
        try {
          await sendPasswordChangeConfirmation(user.email, user.name || undefined)
          log("INFO", "Password changed successfully", { userId: user.id, email: user.email })
          return Response.json({
            message: "Password has been changed successfully",
          })
        } catch (emailError) {
          log("ERROR", "Failed to send password change confirmation email", {
            userId: user.id,
            email: user.email,
            error: emailError,
          })
          return Response.json({
            message: "Password has been changed successfully, but we were unable to send a confirmation email.",
            emailNotification: "failed",
          })
        }
      } catch (error) {
        log("ERROR", "Change password error", error)
        return Response.json(
          { error: "Failed to change password" },
          { status: 500 }
        )
      }
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
