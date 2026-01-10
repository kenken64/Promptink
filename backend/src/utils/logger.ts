type LogLevel = "INFO" | "ERROR" | "DEBUG"

export function log(level: LogLevel, message: string, data?: unknown) {
  const timestamp = new Date().toISOString()
  const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : ""
  console.log(`[${timestamp}] [${level}] ${message}${dataStr}`)
}
