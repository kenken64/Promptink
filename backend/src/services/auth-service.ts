import { userQueries, tokenBlacklistQueries, refreshTokenQueries, passwordResetTokenQueries, type User } from "../db"
import { log } from "../utils"

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET

// Access token: 15 minutes (short-lived for security)
const JWT_ACCESS_EXPIRES_IN = 15 * 60 // 15 minutes in seconds

// Refresh token: 7 days (longer-lived, stored in database)
const JWT_REFRESH_EXPIRES_IN = 7 * 24 * 60 * 60 // 7 days in seconds

// CRITICAL: Enforce JWT_SECRET in production
if (process.env.NODE_ENV === "production" && !JWT_SECRET) {
  console.error("[AUTH] CRITICAL: JWT_SECRET must be set in production!")
  console.error("[AUTH] Generate a secure secret with: openssl rand -base64 32")
  process.exit(1)
}

// Log JWT configuration status at module load
if (!JWT_SECRET) {
  console.warn("[AUTH] WARNING: JWT_SECRET not set, using default (insecure for production)")
} else {
  console.log("[AUTH] JWT_SECRET configured from environment")
  console.log(`[AUTH] Access token expiry: ${JWT_ACCESS_EXPIRES_IN}s (${JWT_ACCESS_EXPIRES_IN / 60} minutes)`)
  console.log(`[AUTH] Refresh token expiry: ${JWT_REFRESH_EXPIRES_IN}s (${JWT_REFRESH_EXPIRES_IN / 60 / 60 / 24} days)`)
}

const SECRET = JWT_SECRET || "promptink-secret-change-in-production"
const REFRESH_SECRET = JWT_REFRESH_SECRET || SECRET

export interface JWTPayload {
  userId: number
  email: string
  jti: string // JWT ID for tracking and revocation
  iat: number
  exp: number
  type: "access" | "refresh"
}

export interface AuthUser {
  id: number
  email: string
  name: string | null
  created_at: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

// Generate a unique JWT ID using cryptographically secure random UUID
function generateJti(): string {
  return crypto.randomUUID()
}

// Hash a string using SHA-256 (for storing refresh token hashes)
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

// Constant-time string comparison (prevents timing attacks)
function constantTimeEqual(a: string, b: string): boolean {
  // Compare in time proportional to the maximum length,
  // and fold length differences into the result instead of returning early.
  const len = Math.max(a.length, b.length)
  let result = a.length ^ b.length

  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0
    const cb = i < b.length ? b.charCodeAt(i) : 0
    result |= ca ^ cb
  }

  return result === 0
}

// Base64URL encoding (RFC 4648) with proper UTF-8 support
function base64urlEncode(data: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(data)

  // Use chunked approach for robustness with large data
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
  const base64 = btoa(binary)

  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

// Base64URL decoding with proper UTF-8 support
function base64urlDecode(data: string): string {
  // Add padding
  const padded = data + "=".repeat((4 - (data.length % 4)) % 4)
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/")

  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const decoder = new TextDecoder()
    return decoder.decode(bytes)
  } catch (error) {
    throw new Error("Invalid base64url string")
  }
}

// HMAC-SHA256 signing with constant-time comparison
async function signHMAC(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(data)

  // Use Web Crypto API for HMAC
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign("HMAC", key, messageData)
  const signatureArray = Array.from(new Uint8Array(signature))

  // Use chunked approach for robustness
  const binary = signatureArray.map((b) => String.fromCharCode(b)).join('')
  const base64 = btoa(binary)

  // URL-safe base64
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

// Hash password using Bun's built-in password hashing (Argon2)
export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: "argon2id",
    memoryCost: 65536,
    timeCost: 2,
  })
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash)
}

// Generate JWT token (access or refresh)
async function generateToken(user: User, type: "access" | "refresh", jti: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = type === "access" ? JWT_ACCESS_EXPIRES_IN : JWT_REFRESH_EXPIRES_IN

  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    jti,
    iat: now,
    exp: now + expiresIn,
    type,
  }

  // Create JWT manually (header.payload.signature)
  const header = { alg: "HS256", typ: "JWT" }
  const headerB64 = base64urlEncode(JSON.stringify(header))
  const payloadB64 = base64urlEncode(JSON.stringify(payload))

  const data = `${headerB64}.${payloadB64}`
  const secret = type === "access" ? SECRET : REFRESH_SECRET
  const signature = await signHMAC(data, secret)

  return `${data}.${signature}`
}

// Generate access + refresh token pair
export async function generateTokenPair(
  user: User,
  ipAddress?: string,
  userAgent?: string
): Promise<TokenPair> {
  const accessJti = generateJti()
  const refreshJti = generateJti()

  const accessToken = await generateToken(user, "access", accessJti)
  const refreshToken = await generateToken(user, "refresh", refreshJti)

  // Store refresh token hash in database
  const refreshTokenHash = await hashToken(refreshToken)
  const expiresAt = new Date(Date.now() + JWT_REFRESH_EXPIRES_IN * 1000).toISOString()

  try {
    refreshTokenQueries.create.get(
      user.id,
      refreshTokenHash,
      refreshJti,
      expiresAt,
      ipAddress || null,
      userAgent || null
    )
  } catch (error) {
    log("ERROR", "Failed to store refresh token - database insert failed", error)
    // If we can't store the refresh token, we should regenerate with a new JTI
    // to avoid returning a token that won't work
    throw new Error("Failed to create refresh token - please try again")
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_ACCESS_EXPIRES_IN,
  }
}

// Verify JWT token
export async function verifyToken(token: string, type: "access" | "refresh" = "access"): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, signature] = parts
    
    // Ensure all parts are defined
    if (!headerB64 || !payloadB64 || !signature) return null

    // Decode and verify header
    const headerJson = base64urlDecode(headerB64)
    const header = JSON.parse(headerJson)

    // Verify algorithm is HS256 (prevent algorithm confusion attacks)
    if (header.alg !== "HS256" || header.typ !== "JWT") {
      log("WARN", "Invalid JWT algorithm or type", { alg: header.alg, typ: header.typ })
      return null
    }

    const data = `${headerB64}.${payloadB64}`

    // Verify signature using constant-time comparison
    const secret = type === "access" ? SECRET : REFRESH_SECRET
    const expectedSignature = await signHMAC(data, secret)

    if (!constantTimeEqual(signature, expectedSignature)) {
      log("WARN", "Invalid JWT signature")
      return null
    }

    // Decode payload
    const payloadJson = base64urlDecode(payloadB64)
    const payload: JWTPayload = JSON.parse(payloadJson)

    // Verify token type matches
    if (payload.type !== type) {
      log("WARN", "Token type mismatch", { expected: type, actual: payload.type })
      return null
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      log("WARN", "JWT token expired")
      return null
    }

    // Check iat is not in the future (prevent clock skew attacks)
    if (payload.iat > now + 60) { // Allow 60 seconds clock skew
      log("WARN", "JWT issued in the future", { iat: payload.iat, now })
      return null
    }

    // Check if token is blacklisted (revoked)
    if (payload.jti) {
      const blacklisted = tokenBlacklistQueries.findByJti.get(payload.jti)
      if (blacklisted) {
        log("WARN", "JWT token is blacklisted", { jti: payload.jti })
        return null
      }
    }

    return payload
  } catch (error) {
    log("ERROR", "JWT verification failed", error)
    return null
  }
}

// Refresh access token using refresh token
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number } | { error: string }> {
  try {
    // Verify refresh token
    const payload = await verifyToken(refreshToken, "refresh")
    if (!payload) {
      return { error: "Invalid or expired refresh token" }
    }

    // Check if refresh token exists in database and is not revoked
    const refreshTokenHash = await hashToken(refreshToken)
    const storedToken = refreshTokenQueries.findByTokenHash.get(refreshTokenHash)

    if (!storedToken) {
      log("WARN", "Refresh token not found in database", { jti: payload.jti })
      return { error: "Invalid refresh token" }
    }

    // Verify token expiration both in payload and database
    const now = new Date()
    const expiresAt = new Date(storedToken.expires_at)
    const payloadExpiry = new Date(payload.exp * 1000)

    if (expiresAt < now || payloadExpiry < now) {
      log("WARN", "Refresh token expired", {
        jti: payload.jti,
        dbExpiry: expiresAt.toISOString(),
        tokenExpiry: payloadExpiry.toISOString()
      })
      return { error: "Refresh token expired" }
    }

    // Verify JTI matches between token and database
    if (storedToken.jti !== payload.jti) {
      log("WARN", "JTI mismatch between token and database", {
        tokenJti: payload.jti,
        dbJti: storedToken.jti
      })
      return { error: "Invalid refresh token" }
    }

    // Update last used timestamp
    refreshTokenQueries.updateLastUsed.run(now.toISOString(), storedToken.id)

    // Get user
    const user = userQueries.findById.get(payload.userId)
    if (!user) {
      return { error: "User not found" }
    }

    // Generate new access token
    const accessJti = generateJti()
    const accessToken = await generateToken(user, "access", accessJti)

    return {
      accessToken,
      expiresIn: JWT_ACCESS_EXPIRES_IN,
    }
  } catch (error) {
    log("ERROR", "Token refresh failed", error)
    return { error: "Token refresh failed" }
  }
}

// Revoke a specific token (add to blacklist)
export function revokeToken(jti: string, userId: number, exp: number, reason?: string): void {
  try {
    const expiresAt = new Date(exp * 1000).toISOString()
    tokenBlacklistQueries.create.get(jti, userId, expiresAt, reason || null)
    log("INFO", "Token revoked", { jti, userId, reason })
  } catch (error) {
    log("ERROR", "Failed to revoke token", error)
  }
}

// Revoke all refresh tokens for a user (logout all devices)
export function revokeAllUserTokens(userId: number): void {
  try {
    refreshTokenQueries.revokeAllByUserId.run(userId)
    log("INFO", "All tokens revoked for user", { userId })
  } catch (error) {
    log("ERROR", "Failed to revoke all user tokens", error)
  }
}

// Clean up expired tokens (should be run periodically)
export function cleanupExpiredTokens(): void {
  try {
    const now = new Date().toISOString()
    tokenBlacklistQueries.deleteExpired.run(now)
    refreshTokenQueries.deleteExpired.run(now)
    passwordResetTokenQueries.deleteExpired.run(now)
    log("INFO", "Expired tokens cleaned up (blacklist, refresh, password reset)")
  } catch (error) {
    log("ERROR", "Failed to cleanup expired tokens", error)
  }
}

// Validate password strength
function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" }
  }

  // Check for at least one number or special character
  if (!/[0-9!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number or special character" }
  }

  // Check for at least one letter
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one letter" }
  }

  return { valid: true }
}

// Register a new user
export async function registerUser(
  email: string,
  password: string,
  name?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ user: AuthUser; tokens: TokenPair } | { error: string }> {
  try {
    // Check if user already exists
    const existingUser = userQueries.findByEmail.get(email.toLowerCase())
    if (existingUser) {
      return { error: "Registration failed. Please try again." } // Generic error to prevent email enumeration
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return { error: "Invalid email format" }
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.valid) {
      return { error: passwordValidation.error! }
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const user = userQueries.create.get(email.toLowerCase(), passwordHash, name || null)
    if (!user) {
      return { error: "Failed to create user" }
    }

    // Generate tokens
    const tokens = await generateTokenPair(user, ipAddress, userAgent)

    log("INFO", "User registered", { userId: user.id, email: user.email })

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
      },
      tokens,
    }
  } catch (error) {
    log("ERROR", "Registration failed", error)
    return { error: "Registration failed" }
  }
}

// Login user
export async function loginUser(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ user: AuthUser; tokens: TokenPair } | { error: string }> {
  try {
    // Find user
    const normalizedEmail = email.toLowerCase()
    log("DEBUG", "Looking up user", { email: normalizedEmail })

    const user = userQueries.findByEmail.get(normalizedEmail)
    if (!user) {
      log("DEBUG", "User not found in database", { email: normalizedEmail })
      return { error: "Invalid email or password" }
    }

    log("DEBUG", "User found", { userId: user.id, email: user.email })

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      log("DEBUG", "Password verification failed", { userId: user.id })
      return { error: "Invalid email or password" }
    }

    // Generate tokens
    const tokens = await generateTokenPair(user, ipAddress, userAgent)

    log("INFO", "User logged in", { userId: user.id, email: user.email })

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
      },
      tokens,
    }
  } catch (error) {
    log("ERROR", "Login failed", error)
    return { error: "Login failed" }
  }
}

// Get user by ID
export function getUserById(id: number): AuthUser | null {
  const user = userQueries.findById.get(id)
  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    created_at: user.created_at,
  }
}

// Email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Extract token from Authorization header
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }
  return null
}
