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
  },
}
