import { log } from "../utils"
import { config } from "../config"

// Brevo API configuration - use centralized config
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
const { brevoApiKey: BREVO_API_KEY, senderEmail: SENDER_EMAIL, senderName: SENDER_NAME, frontendUrl: FRONTEND_URL } = config.email

interface SendEmailParams {
  to: string
  subject: string
  htmlContent: string
  textContent?: string
}

/**
 * Send email using Brevo API
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  if (!BREVO_API_KEY) {
    log("ERROR", "Brevo API key not configured")
    throw new Error("Email service not configured")
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL,
        },
        to: [
          {
            email: params.to,
          },
        ],
        subject: params.subject,
        htmlContent: params.htmlContent,
        textContent: params.textContent,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
      log("ERROR", "Failed to send email via Brevo", {
        status: response.status,
        error: errorData
      })
      return false
    }

    log("INFO", "Email sent successfully", { to: params.to, subject: params.subject })
    return true
  } catch (error) {
    log("ERROR", "Error sending email", { error })
    return false
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
  userName?: string
): Promise<boolean> {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`
  const displayName = userName || email

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Promptink</h1>
      </div>

      <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>

        <p>Hi ${displayName},</p>

        <p>We received a request to reset your password for your Promptink account. Click the button below to create a new password:</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}"
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 14px 30px;
                    text-decoration: none;
                    border-radius: 5px;
                    display: inline-block;
                    font-weight: bold;">
            Reset Password
          </a>
        </div>

        <p>Or copy and paste this link into your browser:</p>
        <p style="background-color: #e9e9e9; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">
          ${resetUrl}
        </p>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          <strong>This link will expire in 1 hour.</strong>
        </p>

        <p style="color: #666; font-size: 14px;">
          If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

        <p style="color: #999; font-size: 12px; text-align: center;">
          This is an automated message from Promptink. Please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `

  const textContent = `
    Password Reset Request

    Hi ${displayName},

    We received a request to reset your password for your Promptink account.

    Click the link below to create a new password:
    ${resetUrl}

    This link will expire in 1 hour.

    If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

    ---
    This is an automated message from Promptink.
  `

  return sendEmail({
    to: email,
    subject: "Reset Your Promptink Password",
    htmlContent,
    textContent,
  })
}

/**
 * Send password change confirmation email
 */
export async function sendPasswordChangeConfirmation(
  email: string,
  userName?: string
): Promise<boolean> {
  const displayName = userName || email
  const loginUrl = `${FRONTEND_URL}/login`

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Changed</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Promptink</h1>
      </div>

      <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Password Successfully Changed</h2>

        <p>Hi ${displayName},</p>

        <p>Your Promptink password has been successfully changed.</p>

        <p>You can now log in with your new password:</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}"
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 14px 30px;
                    text-decoration: none;
                    border-radius: 5px;
                    display: inline-block;
                    font-weight: bold;">
            Go to Login
          </a>
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          <strong>If you didn't make this change,</strong> please contact our support team immediately.
        </p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

        <p style="color: #999; font-size: 12px; text-align: center;">
          This is an automated message from Promptink. Please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `

  const textContent = `
    Password Successfully Changed

    Hi ${displayName},

    Your Promptink password has been successfully changed.

    You can now log in with your new password at:
    ${loginUrl}

    If you didn't make this change, please contact our support team immediately.

    ---
    This is an automated message from Promptink.
  `

  return sendEmail({
    to: email,
    subject: "Your Promptink Password Has Been Changed",
    htmlContent,
    textContent,
  })
}
