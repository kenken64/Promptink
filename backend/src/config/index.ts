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
  },
  server: {
    port: parseInt(process.env.PORT || "3000"),
    baseUrl: process.env.BASE_URL || "http://localhost:3000",
  },
  storage: {
    imagesDir: process.env.IMAGES_DIR || "/app/data/images",
  },
  email: {
    brevoApiKey: process.env.BREVO_API_KEY,
    senderEmail: process.env.SENDER_EMAIL || "noreply@promptink.app",
    senderName: process.env.SENDER_NAME || "Promptink",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  },
}
