import { extractToken, verifyToken, getUserById, type AuthUser, type JWTPayload } from "../services/auth-service"
import { log } from "../utils"

export interface AuthenticatedRequest extends Request {
  user: AuthUser
}

// Middleware to verify JWT and attach user to request
export async function authenticateRequest(
  req: Request
): Promise<{ user: AuthUser; payload: JWTPayload } | { error: string; status: number }> {
  const authHeader = req.headers.get("Authorization")
  const token = extractToken(authHeader)

  if (!token) {
    return { error: "No token provided", status: 401 }
  }

  const payload = await verifyToken(token, "access")
  if (!payload) {
    return { error: "Invalid or expired token", status: 401 }
  }

  const user = getUserById(payload.userId)
  if (!user) {
    return { error: "User not found", status: 401 }
  }

  return { user, payload }
}

// Helper to create protected route handler
export function withAuth(
  handler: (req: Request, user: AuthUser, payload?: JWTPayload) => Promise<Response> | Response
) {
  return async (req: Request): Promise<Response> => {
    const authResult = await authenticateRequest(req)

    if ("error" in authResult) {
      return Response.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    return handler(req, authResult.user, authResult.payload)
  }
}

// Optional auth - attaches user if token present, but doesn't require it
export async function optionalAuth(
  req: Request
): Promise<{ user: AuthUser | null; payload: JWTPayload | null }> {
  const authHeader = req.headers.get("Authorization")
  const token = extractToken(authHeader)

  if (!token) {
    return { user: null, payload: null }
  }

  const payload = await verifyToken(token, "access")
  if (!payload) {
    return { user: null, payload: null }
  }

  const user = getUserById(payload.userId)
  return { user, payload }
}
