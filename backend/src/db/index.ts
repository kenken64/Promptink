import { Database, Statement } from "bun:sqlite"
import { log } from "../utils"
import { mkdirSync } from "fs"
import { dirname } from "path"

const DB_PATH = process.env.DB_PATH || "./data/promptink.db"

// Ensure data directory exists
try {
  mkdirSync(dirname(DB_PATH), { recursive: true })
} catch {}

export const db = new Database(DB_PATH)

// User type
export interface User {
  id: number
  email: string
  password_hash: string
  name: string | null
  trmnl_device_api_key: string | null
  trmnl_mac_address: string | null
  created_at: string
  updated_at: string
}

// User settings (subset of User for settings page)
export interface UserSettings {
  trmnl_device_api_key: string | null
  trmnl_mac_address: string | null
}

// Synced image type
export interface SyncedImage {
  id: number
  user_id: number
  image_url: string
  prompt: string | null
  synced_at: string
}

// Initialize database tables
export function initDatabase() {
  log("INFO", "Initializing database...")

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create index on email for faster lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`)

  // Add TRMNL settings columns if they don't exist (migration)
  try {
    db.run(`ALTER TABLE users ADD COLUMN trmnl_device_api_key TEXT`)
  } catch {}
  try {
    db.run(`ALTER TABLE users ADD COLUMN trmnl_mac_address TEXT`)
  } catch {}

  // Synced images table (per user)
  db.run(`
    CREATE TABLE IF NOT EXISTS synced_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      prompt TEXT,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create index on user_id for faster lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_synced_images_user_id ON synced_images(user_id)`)

  // Sessions/refresh tokens table (optional, for token invalidation)
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Initialize prepared statements after tables are created
  initPreparedStatements()

  log("INFO", "Database initialized successfully")
}

// Prepared statements (initialized after tables exist)
let _userQueries: {
  findByEmail: Statement<User, [string]>
  findById: Statement<User, [number]>
  create: Statement<User, [string, string, string | null]>
  updatePassword: Statement<void, [string, number]>
  updateSettings: Statement<void, [string | null, string | null, number]>
  getSettings: Statement<UserSettings, [number]>
}

let _syncedImageQueries: {
  findLatestByUserId: Statement<SyncedImage, [number]>
  findAllByUserId: Statement<SyncedImage, [number]>
  create: Statement<SyncedImage, [number, string, string | null]>
  deleteByUserId: Statement<void, [number]>
}

function initPreparedStatements() {
  _userQueries = {
    findByEmail: db.prepare<User, [string]>(
      "SELECT * FROM users WHERE email = ?"
    ),
    findById: db.prepare<User, [number]>(
      "SELECT * FROM users WHERE id = ?"
    ),
    create: db.prepare<User, [string, string, string | null]>(
      "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?) RETURNING *"
    ),
    updatePassword: db.prepare<void, [string, number]>(
      "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    updateSettings: db.prepare<void, [string | null, string | null, number]>(
      "UPDATE users SET trmnl_device_api_key = ?, trmnl_mac_address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    getSettings: db.prepare<UserSettings, [number]>(
      "SELECT trmnl_device_api_key, trmnl_mac_address FROM users WHERE id = ?"
    ),
  }

  _syncedImageQueries = {
    findLatestByUserId: db.prepare<SyncedImage, [number]>(
      "SELECT * FROM synced_images WHERE user_id = ? ORDER BY synced_at DESC LIMIT 1"
    ),
    findAllByUserId: db.prepare<SyncedImage, [number]>(
      "SELECT * FROM synced_images WHERE user_id = ? ORDER BY synced_at DESC"
    ),
    create: db.prepare<SyncedImage, [number, string, string | null]>(
      "INSERT INTO synced_images (user_id, image_url, prompt) VALUES (?, ?, ?) RETURNING *"
    ),
    deleteByUserId: db.prepare<void, [number]>(
      "DELETE FROM synced_images WHERE user_id = ?"
    ),
  }
}

// Getters for prepared statements
export const userQueries = {
  get findByEmail() { return _userQueries.findByEmail },
  get findById() { return _userQueries.findById },
  get create() { return _userQueries.create },
  get updatePassword() { return _userQueries.updatePassword },
  get updateSettings() { return _userQueries.updateSettings },
  get getSettings() { return _userQueries.getSettings },
}

export const syncedImageQueries = {
  get findLatestByUserId() { return _syncedImageQueries.findLatestByUserId },
  get findAllByUserId() { return _syncedImageQueries.findAllByUserId },
  get create() { return _syncedImageQueries.create },
  get deleteByUserId() { return _syncedImageQueries.deleteByUserId },
}
