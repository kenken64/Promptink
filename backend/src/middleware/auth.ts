import { extractToken, verifyToken, getUserById, type AuthUser } from "../services/auth-service"
import { log } from "../utils"

export interface AuthenticatedRequest extends Request {
  user: AuthUser
}

// Middleware to verify JWT and attach user to request
export async function authenticateRequest(
  req: Request
): Promise<{ user: AuthUser } | { error: string; status: number }> {
  const authHeader = req.headers.get("Authorization")
  const token = extractToken(authHeader)

  if (!token) {
    return { error: "No token provided", status: 401 }
  }

  const payload = verifyToken(token)
  if (!payload) {
    return { error: "Invalid or expired token", status: 401 }
  }

  const user = getUserById(payload.userId)
  if (!user) {
    return { error: "User not found", status: 401 }
  }

  return { user }
}

// Helper to create protected route handler
export function withAuth(
  handler: (req: Request, user: AuthUser) => Promise<Response> | Response
) {
  return async (req: Request): Promise<Response> => {
    const authResult = await authenticateRequest(req)

    if ("error" in authResult) {
      return Response.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    return handler(req, authResult.user)
  }
}

// Optional auth - attaches user if token present, but doesn't require it
export async function optionalAuth(
  req: Request
): Promise<AuthUser | null> {
  const authHeader = req.headers.get("Authorization")
  const token = extractToken(authHeader)

  if (!token) {
    return null
  }

  const payload = verifyToken(token)
  if (!payload) {
    return null
  }

  return getUserById(payload.userId)
}
