// Simple in-memory store for the latest synced image
// In production, you might want to use Redis or a database

interface SyncedImage {
  imageUrl: string
  prompt?: string
  syncedAt: string
}

let latestImage: SyncedImage | null = null

export function setLatestImage(imageUrl: string, prompt?: string): SyncedImage {
  latestImage = {
    imageUrl,
    prompt,
    syncedAt: new Date().toISOString(),
  }
  return latestImage
}

export function getLatestImage(): SyncedImage | null {
  return latestImage
}

export function clearLatestImage(): void {
  latestImage = null
}
