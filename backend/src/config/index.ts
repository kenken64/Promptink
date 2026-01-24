export const config = {
  trmnl: {
    apiBase: "https://usetrmnl.com/api",
    deviceApiKey: process.env.TRMNL_DEVICE_API_KEY!,
    userApiKey: process.env.TRMNL_USER_API_KEY,
    macAddress: process.env.TRMNL_MAC_ADDRESS!,
    customPluginUuid: process.env.TRMNL_CUSTOM_PLUGIN_UUID,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    adminKey: process.env.OPENAI_ADMIN_KEY, // Optional: for usage/billing API access
  },
  server: {
    port: parseInt(process.env.PORT || "3000"),
    baseUrl: process.env.BASE_URL || "http://localhost:3000",
  },
  storage: {
    imagesDir: process.env.IMAGES_DIR || "/app/data/images",
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    senderEmail: process.env.SENDER_EMAIL || "noreply@promptink.app",
    senderName: process.env.SENDER_NAME || "Promptink",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  },
  admin: {
    password: process.env.ADMIN_PASSWORD || "admin123",
    jwtSecret: process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || "admin-secret-key",
  },
}
