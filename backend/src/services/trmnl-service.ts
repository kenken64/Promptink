import { config } from "../config"
import { log } from "../utils"

export interface TRMNLDisplayResponse {
  status: number
  image_url: string
  filename: string
  refresh_rate: number
  reset_firmware: boolean
  update_firmware: boolean
  firmware_url: string
}

export interface PluginSetting {
  id: number
  uuid: string
  plugin_name: string
  data: Record<string, unknown>
}

async function deviceRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  log("DEBUG", `Device API request: ${options.method || "GET"} ${endpoint}`)
  const headers = new Headers(options.headers)
  headers.set("access-token", config.trmnl.deviceApiKey)
  headers.set("ID", config.trmnl.macAddress)
  headers.set("Content-Type", "application/json")

  const response = await fetch(`${config.trmnl.apiBase}${endpoint}`, {
    ...options,
    headers,
  })
  log("DEBUG", `Device API response: ${response.status}`)
  return response
}

async function userRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  if (!config.trmnl.userApiKey) {
    throw new Error("TRMNL_USER_API_KEY not configured. Get it from your TRMNL account settings.")
  }

  log("DEBUG", `User API request: ${options.method || "GET"} ${endpoint}`)
  const headers = new Headers(options.headers)
  headers.set("Authorization", `Bearer ${config.trmnl.userApiKey}`)
  headers.set("Content-Type", "application/json")

  const response = await fetch(`${config.trmnl.apiBase}${endpoint}`, {
    ...options,
    headers,
  })
  log("DEBUG", `User API response: ${response.status}`)
  return response
}

export async function getCurrentScreen(): Promise<TRMNLDisplayResponse> {
  const response = await deviceRequest("/display")
  return await response.json() as TRMNLDisplayResponse
}

export async function getCurrentScreenPreview(): Promise<TRMNLDisplayResponse> {
  const response = await deviceRequest("/display/current")
  return await response.json() as TRMNLDisplayResponse
}

export async function getPluginSettings(): Promise<PluginSetting[]> {
  const response = await userRequest("/plugin_settings")
  return await response.json() as PluginSetting[]
}

export async function updatePluginData(
  pluginSettingId: number,
  data: Record<string, unknown>
): Promise<Response> {
  log("INFO", `Updating plugin ${pluginSettingId}`, data)
  return userRequest(`/plugin_settings/${pluginSettingId}/data`, {
    method: "POST",
    body: JSON.stringify({ merge_variables: data }),
  })
}

export async function renderMarkup(
  markup: string,
  variables: Record<string, unknown> = {}
): Promise<string> {
  const response = await userRequest("/markup", {
    method: "POST",
    body: JSON.stringify({ markup, merge_variables: variables }),
  })
  const result = await response.json() as { markup: string }
  return result.markup
}

export async function uploadPluginImage(
  pluginSettingId: number,
  imageBuffer: ArrayBuffer,
  filename: string
): Promise<Response> {
  if (!config.trmnl.userApiKey) {
    throw new Error("TRMNL_USER_API_KEY not configured.")
  }

  log("INFO", `Uploading image to plugin ${pluginSettingId}`, { filename })

  const formData = new FormData()
  formData.append("image", new Blob([imageBuffer]), filename)

  return fetch(`${config.trmnl.apiBase}/plugin_settings/${pluginSettingId}/image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.trmnl.userApiKey}`,
    },
    body: formData,
  })
}

export async function sendToCustomPlugin(
  uuid: string,
  mergeVariables: Record<string, unknown>
): Promise<Response> {
  log("INFO", `Sending data to custom plugin ${uuid}`, mergeVariables)

  return fetch(`${config.trmnl.apiBase}/custom_plugins/${uuid}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ merge_variables: mergeVariables }),
  })
}

export function getDeviceInfo() {
  return {
    mac_address: config.trmnl.macAddress,
    device_api_configured: !!config.trmnl.deviceApiKey,
    user_api_configured: !!config.trmnl.userApiKey,
    custom_plugin_configured: !!config.trmnl.customPluginUuid,
  }
}
