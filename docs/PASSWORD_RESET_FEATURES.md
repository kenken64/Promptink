# Password Reset Features

This document describes the password reset and change password features implemented in Promptink.

## Features

1. **Forgot Password** (Public) - Users can request a password reset link via email
2. **Reset Password** (Public with token) - Users can reset their password using a token from email
3. **Change Password** (Authenticated) - Logged-in users can change their password

## Setup

### 1. Resend API Configuration

These features require a Resend account for sending emails. Follow these steps:

1. Sign up for a free account at [Resend](https://resend.com/)
2. Get your API key from [API Keys](https://resend.com/api-keys)
3. Add a verified domain or use the sandbox domain for testing
4. Add the following environment variables to your `.env` file:

```env
# Resend Email Service
RESEND_API_KEY=re_your-api-key-here
SENDER_EMAIL=noreply@yourdomain.com
SENDER_NAME=Promptink
FRONTEND_URL=https://yourdomain.com
```

### 2. Database Migration

The password reset features require a new database table. The migration is automatic:
- Table: `password_reset_tokens`
- Indexes on: `user_id`, `token`, `expires_at`

The table will be created automatically when the server starts.

## API Endpoints

### 1. Forgot Password (Public)

Request a password reset email.

**Endpoint:** `POST /api/auth/forgot-password`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:** 200 OK
```json
{
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Notes:**
- Always returns success to prevent email enumeration
- Token expires in 1 hour
- Only one active token per user (old tokens are invalidated)
- Sends a beautifully formatted HTML email with reset link
- Expired tokens are automatically cleaned up by the scheduler service

**Rate Limiting:** Rate limiting is currently disabled in the application. Configure rate limiting at your API gateway or reverse proxy (recommended: 10 requests per 15 minutes per IP or email) to mitigate abuse.

---

### 2. Reset Password with Token (Public)

Reset password using the token received via email.

**Endpoint:** `POST /api/auth/reset-password`

**Request Body:**
```json
{
  "token": "64-character-hex-token",
  "newPassword": "newSecurePassword123"
}
```

**Response:** 200 OK
```json
{
  "message": "Password has been reset successfully. You can now log in with your new password."
}
```

**Validation:**
- Token must be valid and not expired
- Token must not have been used already
- New password must be at least 8 characters long

**Error Responses:**
- 400: Invalid or expired token
- 400: Password too short
- 404: User not found

**Notes:**
- Token is marked as used after successful reset
- Sends a confirmation email to the user
- User must log in again with the new password

---

### 3. Change Password (Authenticated)

Change password while logged in.

**Endpoint:** `POST /api/auth/change-password`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword123"
}
```

**Response:** 200 OK
```json
{
  "message": "Password has been changed successfully"
}
```

**Validation:**
- User must be authenticated
- Current password must be correct
- New password must be at least 8 characters long
- New password must be different from current password

**Error Responses:**
- 401: Current password is incorrect
- 401: Not authenticated
- 400: Passwords are required
- 400: New password too short
- 400: New password same as current

**Notes:**
- Sends a confirmation email to the user
- User remains logged in after password change
- Does not invalidate existing sessions

## Email Templates

The email service sends beautifully formatted HTML emails with:
- Responsive design for mobile and desktop
- Gradient header with Promptink branding
- Clear call-to-action buttons
- Plain text fallback for email clients that don't support HTML
- Security information and expiration notices

### Password Reset Email
- Subject: "Reset Your Promptink Password"
- Contains reset link button and plain URL
- Expires in 1 hour
- Security notice if request wasn't made by user

### Password Change Confirmation Email
- Subject: "Your Promptink Password Has Been Changed"
- Confirms successful password change
- Link to login page
- Security warning if change wasn't made by user

## Security Features

1. **Token Security:**
   - 256-bit random tokens (64 hex characters)
   - Generated using `crypto.getRandomValues()`
   - One-time use only (marked as used after reset)
   - 1-hour expiration
   - Automatic cleanup of old tokens

2. **Email Enumeration Prevention:**
   - Forgot password always returns success message
   - Same response whether email exists or not
   - Prevents attackers from discovering valid email addresses

3. **Password Requirements:**
   - Minimum 8 characters
   - Must be different from current password (for change password)
   - Hashed using Argon2id algorithm

4. **Rate Limiting:**
   - Rate limiting is currently disabled in the application
   - Configure rate limiting at your API gateway or reverse proxy
   - Recommended: 10 requests per 15 minutes per IP/email for auth endpoints
   - Helps prevent brute force attacks and email flooding abuse

5. **Logging:**
   - All password operations are logged
   - Includes email and user ID (when available)
   - Failed attempts are logged for security monitoring

## Frontend Integration

### Forgot Password Flow

1. User clicks "Forgot Password" on login page
2. User enters their email address
3. Frontend calls `POST /api/auth/forgot-password`
4. Show success message (don't indicate if email exists)
5. User checks email and clicks reset link
6. User is redirected to reset password page with token in URL
7. User enters new password
8. Frontend calls `POST /api/auth/reset-password`
9. Redirect to login page with success message

### Change Password Flow

1. User navigates to account settings
2. User enters current password and new password
3. Frontend calls `POST /api/auth/change-password` with Bearer token
4. Show success message
5. User continues using the app (no need to log in again)

## Testing

### Manual Testing

1. **Test Forgot Password:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

2. **Test Reset Password:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/reset-password \
     -H "Content-Type: application/json" \
     -d '{"token": "your-token-here", "newPassword": "newPassword123"}'
   ```

3. **Test Change Password:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/change-password \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-jwt-token" \
     -d '{"currentPassword": "oldPassword123", "newPassword": "newPassword123"}'
   ```

## Troubleshooting

### Email Not Sending

1. Check that `RESEND_API_KEY` is set correctly
2. Verify the API key is valid in Resend dashboard
3. Check server logs for email errors
4. Ensure your domain is verified in Resend (or use sandbox for testing)

### Token Invalid or Expired

1. Tokens expire after 1 hour
2. Tokens can only be used once
3. Request a new password reset if token has expired

### Password Requirements Not Met

- Ensure password is at least 8 characters
- For change password, ensure new password is different from current

## Database Schema

### password_reset_tokens Table

```sql
CREATE TABLE password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)

-- Indexes
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token)
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at)
```

## Future Enhancements

Potential improvements for future versions:

1. **Multiple email templates** - Welcome emails, account notifications
2. **Email verification** - Verify email addresses on signup
3. **Two-factor authentication** - Add 2FA for enhanced security
4. **Session management** - Invalidate all sessions on password change
5. **Password history** - Prevent reuse of recent passwords
6. **Configurable expiration** - Allow admins to set token expiration time
7. **Branding customization** - Customize email templates per deployment
8. **Account recovery** - Additional recovery options beyond email

## Support

For issues or questions:
- Check server logs for detailed error messages
- Verify all environment variables are set correctly
- Ensure your domain is verified in Resend
- Review the Resend API documentation at https://resend.com/docs
