import { userQueries, type User } from "../db"
import { log } from "../utils"

// JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || "promptink-secret-change-in-production"
const JWT_EXPIRES_IN = 7 * 24 * 60 * 60 // 7 days in seconds

export interface JWTPayload {
  userId: number
  email: string
  iat: number
  exp: number
}

export interface AuthUser {
  id: number
  email: string
  name: string | null
  created_at: string
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

// Generate JWT token
export function generateToken(user: User): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    iat: now,
    exp: now + JWT_EXPIRES_IN,
  }

  // Create JWT manually (header.payload.signature)
  const header = { alg: "HS256", typ: "JWT" }
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "")
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "")

  const data = `${headerB64}.${payloadB64}`
  const signature = signHMAC(data, JWT_SECRET)

  return `${data}.${signature}`
}

// Verify JWT token
export function verifyToken(token: string): JWTPayload | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, signature] = parts
    const data = `${headerB64}.${payloadB64}`

    // Verify signature
    const expectedSignature = signHMAC(data, JWT_SECRET)
    if (signature !== expectedSignature) {
      log("WARN", "Invalid JWT signature")
      return null
    }

    // Decode payload
    const payload: JWTPayload = JSON.parse(atob(payloadB64))

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      log("WARN", "JWT token expired")
      return null
    }

    return payload
  } catch (error) {
    log("ERROR", "JWT verification failed", error)
    return null
  }
}

// HMAC-SHA256 signing
function signHMAC(data: string, secret: string): string {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(data)

  // Use Web Crypto API for HMAC
  const hmac = new Bun.CryptoHasher("sha256", keyData)
  hmac.update(messageData)
  const hash = hmac.digest("base64")

  // URL-safe base64
  return hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

// Register a new user
export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<{ user: AuthUser; token: string } | { error: string }> {
  try {
    // Check if user already exists
    const existingUser = userQueries.findByEmail.get(email.toLowerCase())
    if (existingUser) {
      return { error: "Email already registered" }
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return { error: "Invalid email format" }
    }

    // Validate password strength
    if (password.length < 6) {
      return { error: "Password must be at least 6 characters" }
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const user = userQueries.create.get(email.toLowerCase(), passwordHash, name || null)
    if (!user) {
      return { error: "Failed to create user" }
    }

    // Generate token
    const token = generateToken(user)

    log("INFO", "User registered", { userId: user.id, email: user.email })

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
      },
      token,
    }
  } catch (error) {
    log("ERROR", "Registration failed", error)
    return { error: "Registration failed" }
  }
}

// Login user
export async function loginUser(
  email: string,
  password: string
): Promise<{ user: AuthUser; token: string } | { error: string }> {
  try {
    // Find user
    const user = userQueries.findByEmail.get(email.toLowerCase())
    if (!user) {
      return { error: "Invalid email or password" }
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      return { error: "Invalid email or password" }
    }

    // Generate token
    const token = generateToken(user)

    log("INFO", "User logged in", { userId: user.id, email: user.email })

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
      },
      token,
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
