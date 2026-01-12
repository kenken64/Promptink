import { useState, useEffect } from "react"

export type Language = "en" | "zh"

export const translations = {
  en: {
    appName: "PromptInk",
    welcome: "What image would you like to create?",
    welcomeSubtitle: "Describe your vision and I'll generate a unique image using DALL-E 3",
    placeholder: "Describe the image you want to create...",
    placeholderListening: "Listening...",
    generate: "Generate",
    generating: "Generating...",
    generatingImage: "Generating image",
    newChat: "New chat",
    openFullSize: "Open Full Size",
    syncToTrmnl: "Sync to TRMNL",
    syncing: "Syncing...",
    syncSuccess: "Synced!",
    footer: "PromptInk uses DALL-E 3 to generate images. Press Enter to send, Shift+Enter for new line.",
    you: "You",
    assistant: "PromptInk",
    suggestions: [
      "A serene Japanese garden with cherry blossoms at sunset",
      "A futuristic city with flying cars and neon lights",
      "A cozy cabin in the mountains during winter",
      "An underwater palace with bioluminescent creatures",
    ],
    errorPrefix: "Error:",
    defaultImageMessage: "Here's your generated image:",
    logout: "Logout",
    // Auth translations
    auth: {
      login: {
        title: "Welcome back",
        subtitle: "Sign in to continue to PromptInk",
        emailLabel: "Email",
        emailPlaceholder: "Enter your email",
        passwordLabel: "Password",
        passwordPlaceholder: "Enter your password",
        loginButton: "Sign In",
        loggingIn: "Signing in...",
        noAccount: "Don't have an account?",
        signUp: "Sign up",
        forgotPassword: "Forgot password?",
      },
      register: {
        title: "Create account",
        subtitle: "Sign up to start creating images",
        nameLabel: "Name (optional)",
        namePlaceholder: "Enter your name",
        emailLabel: "Email",
        emailPlaceholder: "Enter your email",
        passwordLabel: "Password",
        passwordPlaceholder: "Create a password",
        confirmPasswordLabel: "Confirm Password",
        confirmPasswordPlaceholder: "Confirm your password",
        registerButton: "Create Account",
        registering: "Creating account...",
        hasAccount: "Already have an account?",
        signIn: "Sign in",
        passwordMismatch: "Passwords do not match",
        passwordTooShort: "Password must be at least 6 characters",
      },
    },
    settings: {
      title: "Settings",
      subtitle: "Configure your TRMNL device",
      deviceApiKeyLabel: "TRMNL Device API Key",
      deviceApiKeyPlaceholder: "Enter your device API key",
      macAddressLabel: "TRMNL MAC Address",
      macAddressPlaceholder: "e.g. 58:8C:81:A9:7D:14",
      backgroundColorLabel: "TRMNL Background Color",
      backgroundColorBlack: "Black",
      backgroundColorWhite: "White",
      saveButton: "Save Settings",
      saving: "Saving...",
      saveSuccess: "Settings saved successfully",
      saveError: "Failed to save settings",
      backToChat: "Back to Chat",
      webhookUrl: "Your TRMNL Webhook URL",
      webhookUrlNote: "Use this URL in your TRMNL plugin configuration",
      notConfigured: "Not configured",
    },
  },
  zh: {
    appName: "PromptInk",
    welcome: "您想创建什么图像？",
    welcomeSubtitle: "描述您的想法，我将使用 DALL-E 3 为您生成独特的图像",
    placeholder: "描述您想要创建的图像...",
    placeholderListening: "正在聆听...",
    generate: "生成",
    generating: "生成中...",
    generatingImage: "正在生成图像",
    newChat: "新对话",
    openFullSize: "查看原图",
    syncToTrmnl: "同步到 TRMNL",
    syncing: "同步中...",
    syncSuccess: "已同步！",
    footer: "PromptInk 使用 DALL-E 3 生成图像。按 Enter 发送，Shift+Enter 换行。",
    you: "你",
    assistant: "PromptInk",
    suggestions: [
      "夕阳下宁静的日式庭园，樱花盛开",
      "未来城市，飞行汽车穿梭，霓虹灯闪烁",
      "冬日山间温馨的小木屋",
      "海底宫殿，生物发光的奇幻生物环绕",
    ],
    errorPrefix: "错误：",
    defaultImageMessage: "这是为您生成的图像：",
    logout: "退出登录",
    // Auth translations
    auth: {
      login: {
        title: "欢迎回来",
        subtitle: "登录以继续使用 PromptInk",
        emailLabel: "邮箱",
        emailPlaceholder: "输入您的邮箱",
        passwordLabel: "密码",
        passwordPlaceholder: "输入您的密码",
        loginButton: "登录",
        loggingIn: "登录中...",
        noAccount: "还没有账户？",
        signUp: "注册",
        forgotPassword: "忘记密码？",
      },
      register: {
        title: "创建账户",
        subtitle: "注册以开始创建图像",
        nameLabel: "姓名（可选）",
        namePlaceholder: "输入您的姓名",
        emailLabel: "邮箱",
        emailPlaceholder: "输入您的邮箱",
        passwordLabel: "密码",
        passwordPlaceholder: "创建密码",
        confirmPasswordLabel: "确认密码",
        confirmPasswordPlaceholder: "确认您的密码",
        registerButton: "创建账户",
        registering: "创建中...",
        hasAccount: "已有账户？",
        signIn: "登录",
        passwordMismatch: "密码不匹配",
        passwordTooShort: "密码至少需要6个字符",
      },
    },
    settings: {
      title: "设置",
      subtitle: "配置您的 TRMNL 设备",
      deviceApiKeyLabel: "TRMNL 设备 API 密钥",
      deviceApiKeyPlaceholder: "输入您的设备 API 密钥",
      macAddressLabel: "TRMNL MAC 地址",
      macAddressPlaceholder: "例如 58:8C:81:A9:7D:14",
      backgroundColorLabel: "TRMNL 背景颜色",
      backgroundColorBlack: "黑色",
      backgroundColorWhite: "白色",
      saveButton: "保存设置",
      saving: "保存中...",
      saveSuccess: "设置保存成功",
      saveError: "保存设置失败",
      backToChat: "返回聊天",
      webhookUrl: "您的 TRMNL Webhook URL",
      webhookUrlNote: "在 TRMNL 插件配置中使用此 URL",
      notConfigured: "未配置",
    },
  },
}

export function useLanguage() {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("language") as Language
      if (stored) return stored
      // Detect browser language
      const browserLang = navigator.language.toLowerCase()
      if (browserLang.startsWith("zh")) return "zh"
    }
    return "en"
  })

  useEffect(() => {
    localStorage.setItem("language", language)
  }, [language])

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "en" ? "zh" : "en"))
  }

  const t = translations[language]

  return { language, toggleLanguage, t }
}
