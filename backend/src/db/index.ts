import { Database, Statement } from "bun:sqlite"
import { log } from "../utils"
import { mkdirSync, existsSync, readdirSync, statSync } from "fs"
import { dirname } from "path"

const DB_PATH = process.env.DB_PATH || "./data/promptink.db"
const DATA_DIR = dirname(DB_PATH)

// Log volume/directory status at startup
console.log(`[DB] DB_PATH: ${DB_PATH}`)
console.log(`[DB] DATA_DIR: ${DATA_DIR}`)
console.log(`[DB] DATA_DIR exists before mkdir: ${existsSync(DATA_DIR)}`)

// List what's in /app to see if volume is mounted
try {
  const appContents = readdirSync("/app")
  console.log(`[DB] /app contents: ${appContents.join(", ")}`)

  if (existsSync(DATA_DIR)) {
    const dataContents = readdirSync(DATA_DIR)
    console.log(`[DB] ${DATA_DIR} contents: ${dataContents.length > 0 ? dataContents.join(", ") : "(empty)"}`)
  }
} catch (e) {
  console.log(`[DB] Error listing directories: ${e}`)
}

// Ensure data directory exists
try {
  mkdirSync(DATA_DIR, { recursive: true })
  console.log(`[DB] DATA_DIR exists after mkdir: ${existsSync(DATA_DIR)}`)
} catch (e) {
  console.log(`[DB] mkdir error: ${e}`)
}

// Check if DB file already exists (indicates persistence)
const dbExisted = existsSync(DB_PATH)
console.log(`[DB] Database file existed before open: ${dbExisted}`)

export const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent performance
// WAL allows readers and writers to operate simultaneously
db.exec("PRAGMA journal_mode = WAL")
db.exec("PRAGMA synchronous = NORMAL") // Faster writes, still safe with WAL
db.exec("PRAGMA cache_size = -64000") // 64MB cache
db.exec("PRAGMA temp_store = MEMORY") // Store temp tables in memory

console.log(`[DB] Database opened successfully with WAL mode`)

// User type
export interface User {
  id: number
  email: string
  password_hash: string
  name: string | null
  trmnl_device_api_key: string | null
  trmnl_mac_address: string | null
  razorpay_customer_id: string | null
  subscription_id: string | null
  subscription_status: 'none' | 'active' | 'paused' | 'cancelled' | 'past_due'
  subscription_current_period_end: string | null
  first_order_id: number | null
  owns_trmnl_device: number // 1 if user already owns a TRMNL device (skipped purchase)
  created_at: string
  updated_at: string
}

// Order type
export interface Order {
  id: number
  user_id: number
  order_number: string
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  quantity: number
  unit_price: number
  total_amount: number
  currency: string
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  shipping_name: string
  shipping_email: string | null
  shipping_phone: string
  shipping_address_line1: string
  shipping_address_line2: string | null
  shipping_city: string
  shipping_state: string
  shipping_postal_code: string
  shipping_country: string
  is_gift: boolean
  gift_recipient_name: string | null
  gift_message: string | null
  tracking_number: string | null
  carrier: string | null
  tracking_url: string | null
  created_at: string
  paid_at: string | null
  shipped_at: string | null
  delivered_at: string | null
}

// Order device type (for tracking individual devices in an order)
export interface OrderDevice {
  id: number
  order_id: number
  serial_number: string | null
  mac_address: string | null
  activation_status: 'pending' | 'activated'
  activated_at: string | null
}

// User settings (subset of User for settings page)
export interface UserSettings {
  trmnl_device_api_key: string | null
  trmnl_mac_address: string | null
  trmnl_background_color: "black" | "white"
}

// Synced image type
export interface SyncedImage {
  id: number
  user_id: number
  image_url: string
  prompt: string | null
  synced_at: string
}

// Generated image type (gallery/history)
export interface GeneratedImage {
  id: number
  user_id: number
  image_url: string
  original_prompt: string
  revised_prompt: string | null
  model: string
  size: string
  style: string | null
  is_edit: number
  parent_image_id: number | null
  is_favorite: number
  is_deleted: number
  created_at: string
}

// Scheduled job type
export interface ScheduledJob {
  id: number
  user_id: number
  prompt: string
  size: string
  style_preset: string | null
  schedule_type: 'once' | 'daily' | 'weekly'
  schedule_time: string // HH:MM format
  schedule_days: string | null // JSON array of days for weekly (e.g., "[1,3,5]" for Mon, Wed, Fri)
  scheduled_at: string | null // For 'once' type - specific datetime
  timezone: string
  is_enabled: number
  auto_sync_trmnl: number
  last_run_at: string | null
  next_run_at: string | null
  run_count: number
  created_at: string
  updated_at: string
}

// Batch job type
export interface BatchJob {
  id: number
  user_id: number
  name: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  total_count: number
  completed_count: number
  failed_count: number
  size: string
  style_preset: string | null
  auto_sync_trmnl: number
  created_at: string
  started_at: string | null
  completed_at: string | null
}

// Batch job item type
export interface BatchJobItem {
  id: number
  batch_id: number
  prompt: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  image_id: number | null // Reference to generated_images table
  error_message: string | null
  created_at: string
  completed_at: string | null
  synced_to_trmnl: number // 0 = not synced, 1 = synced
}

// User device type (multiple TRMNL devices per user)
export interface UserDevice {
  id: number
  user_id: number
  name: string
  webhook_uuid: string
  background_color: "black" | "white"
  is_default: number
  mac_address: string | null
  device_api_key: string | null
  created_at: string
  updated_at: string
}

// Password reset token type
export interface PasswordResetToken {
  id: number
  user_id: number
  token: string
  expires_at: string
  used: number
  created_at: string
}

// Token blacklist type
export interface TokenBlacklist {
  id: number
  jti: string
  user_id: number
  expires_at: string
  revoked_at: string
  reason: string | null
}

// Refresh token type
export interface RefreshToken {
  id: number
  user_id: number
  token_hash: string
  jti: string
  expires_at: string
  created_at: string
  last_used_at: string | null
  ip_address: string | null
  user_agent: string | null
  is_revoked: number
  revoked_at: string | null
}

// Initialize database tables
export function initDatabase() {
  log("INFO", "Initializing database...", { dbPath: DB_PATH })

  // Check if database file exists
  const dbFile = Bun.file(DB_PATH)
  log("INFO", "Database file exists:", dbFile.size > 0 ? "yes" : "no (will be created)")

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
  try {
    db.run(`ALTER TABLE users ADD COLUMN trmnl_background_color TEXT DEFAULT 'black'`)
  } catch {}

  // Add subscription columns if they don't exist (migration)
  try {
    db.run(`ALTER TABLE users ADD COLUMN razorpay_customer_id TEXT`)
  } catch {}
  try {
    db.run(`ALTER TABLE users ADD COLUMN subscription_id TEXT`)
  } catch {}
  try {
    db.run(`ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'none'`)
  } catch {}
  try {
    db.run(`ALTER TABLE users ADD COLUMN subscription_current_period_end DATETIME`)
  } catch {}
  try {
    db.run(`ALTER TABLE users ADD COLUMN first_order_id INTEGER REFERENCES orders(id)`)
  } catch {}
  try {
    db.run(`ALTER TABLE users ADD COLUMN owns_trmnl_device INTEGER DEFAULT 0`)
  } catch {}

  // Orders table
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_number TEXT UNIQUE NOT NULL,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price INTEGER NOT NULL,
      total_amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'pending',
      shipping_name TEXT NOT NULL,
      shipping_email TEXT,
      shipping_phone TEXT NOT NULL,
      shipping_address_line1 TEXT NOT NULL,
      shipping_address_line2 TEXT,
      shipping_city TEXT NOT NULL,
      shipping_state TEXT NOT NULL,
      shipping_postal_code TEXT NOT NULL,
      shipping_country TEXT NOT NULL,
      is_gift INTEGER DEFAULT 0,
      gift_recipient_name TEXT,
      gift_message TEXT,
      tracking_number TEXT,
      carrier TEXT,
      tracking_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      shipped_at DATETIME,
      delivered_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create indexes for orders
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON orders(razorpay_order_id)`)

  // Order devices table (for tracking individual devices in an order)
  db.run(`
    CREATE TABLE IF NOT EXISTS order_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      serial_number TEXT,
      mac_address TEXT,
      activation_status TEXT DEFAULT 'pending',
      activated_at DATETIME,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_order_devices_order_id ON order_devices(order_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_order_devices_serial ON order_devices(serial_number)`)

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

  // Generated images table (gallery/history)
  db.run(`
    CREATE TABLE IF NOT EXISTS generated_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      original_prompt TEXT NOT NULL,
      revised_prompt TEXT,
      model TEXT DEFAULT 'dall-e-3',
      size TEXT DEFAULT '1024x1024',
      style TEXT,
      is_edit INTEGER DEFAULT 0,
      parent_image_id INTEGER,
      is_favorite INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_image_id) REFERENCES generated_images(id)
    )
  `)

  // Create indexes for generated_images
  db.run(`CREATE INDEX IF NOT EXISTS idx_generated_images_user_id ON generated_images(user_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images(created_at)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_generated_images_is_favorite ON generated_images(is_favorite)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_generated_images_is_deleted ON generated_images(is_deleted)`)
  // Composite index for optimized gallery queries (user + deleted + created_at)
  db.run(`CREATE INDEX IF NOT EXISTS idx_generated_images_user_deleted_created ON generated_images(user_id, is_deleted, created_at DESC)`)
  // Composite index for favorites queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_generated_images_user_favorite_deleted ON generated_images(user_id, is_favorite, is_deleted)`)

  // Scheduled jobs table
  db.run(`
    CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      size TEXT DEFAULT '1024x1024',
      style_preset TEXT,
      schedule_type TEXT DEFAULT 'once',
      schedule_time TEXT NOT NULL,
      schedule_days TEXT,
      scheduled_at DATETIME,
      timezone TEXT DEFAULT 'UTC',
      is_enabled INTEGER DEFAULT 1,
      auto_sync_trmnl INTEGER DEFAULT 0,
      last_run_at DATETIME,
      next_run_at DATETIME,
      run_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create indexes for scheduled_jobs
  db.run(`CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_user_id ON scheduled_jobs(user_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_next_run_at ON scheduled_jobs(next_run_at)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_is_enabled ON scheduled_jobs(is_enabled)`)

  // Batch jobs table
  db.run(`
    CREATE TABLE IF NOT EXISTS batch_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT,
      status TEXT DEFAULT 'pending',
      total_count INTEGER DEFAULT 0,
      completed_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      size TEXT DEFAULT '1024x1024',
      style_preset TEXT,
      auto_sync_trmnl INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create indexes for batch_jobs
  db.run(`CREATE INDEX IF NOT EXISTS idx_batch_jobs_user_id ON batch_jobs(user_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status)`)

  // Batch job items table
  db.run(`
    CREATE TABLE IF NOT EXISTS batch_job_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      image_id INTEGER,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (batch_id) REFERENCES batch_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (image_id) REFERENCES generated_images(id)
    )
  `)

  // Create indexes for batch_job_items
  db.run(`CREATE INDEX IF NOT EXISTS idx_batch_job_items_batch_id ON batch_job_items(batch_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_batch_job_items_status ON batch_job_items(status)`)

  // Migration: Add synced_to_trmnl column to batch_job_items
  try {
    db.run(`ALTER TABLE batch_job_items ADD COLUMN synced_to_trmnl INTEGER DEFAULT 0`)
  } catch { /* Column already exists */ }

  // Token blacklist table (for revoked tokens)
  db.run(`
    CREATE TABLE IF NOT EXISTS token_blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jti TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reason TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(jti)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at)`)

  // Refresh tokens table
  db.run(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      jti TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME,
      ip_address TEXT,
      user_agent TEXT,
      is_revoked INTEGER DEFAULT 0,
      revoked_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_jti ON refresh_tokens(jti)`)

  // Password reset tokens table
  db.run(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create indexes for password_reset_tokens
  db.run(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at)`)

  // User devices table (multiple TRMNL devices per user)
  // Migration: Remove UNIQUE constraint from webhook_uuid (users enter their own external URLs)
  // Migration 2: Add mac_address and device_api_key columns
  const userDevicesTableExists = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='user_devices'").get()
  if (userDevicesTableExists) {
    // Check if we need to migrate (if the unique constraint exists)
    const tableInfo = db.query("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_devices'").get() as { sql: string } | null
    if (tableInfo?.sql?.includes("UNIQUE")) {
      log("INFO", "Migrating user_devices table to remove UNIQUE constraint from webhook_uuid")
      db.run(`ALTER TABLE user_devices RENAME TO user_devices_old`)
      db.run(`
        CREATE TABLE user_devices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          webhook_uuid TEXT NOT NULL,
          background_color TEXT DEFAULT 'black',
          is_default INTEGER DEFAULT 0,
          mac_address TEXT,
          device_api_key TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)
      db.run(`INSERT INTO user_devices (id, user_id, name, webhook_uuid, background_color, is_default, created_at, updated_at) SELECT id, user_id, name, webhook_uuid, background_color, is_default, created_at, updated_at FROM user_devices_old`)
      db.run(`DROP TABLE user_devices_old`)
      log("INFO", "Migration complete: user_devices table updated")
    }
    
    // Check if mac_address column exists, add it if not
    const columns = db.query("PRAGMA table_info(user_devices)").all() as { name: string }[]
    const hasMacAddress = columns.some(c => c.name === "mac_address")
    if (!hasMacAddress) {
      log("INFO", "Adding mac_address and device_api_key columns to user_devices")
      db.run(`ALTER TABLE user_devices ADD COLUMN mac_address TEXT`)
      db.run(`ALTER TABLE user_devices ADD COLUMN device_api_key TEXT`)
    }
  } else {
    db.run(`
      CREATE TABLE IF NOT EXISTS user_devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        webhook_uuid TEXT NOT NULL,
        background_color TEXT DEFAULT 'black',
        is_default INTEGER DEFAULT 0,
        mac_address TEXT,
        device_api_key TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)
  }

  // Create indexes for user_devices
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_devices_webhook_uuid ON user_devices(webhook_uuid)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_devices_is_default ON user_devices(is_default)`)

  // Initialize prepared statements after tables are created
  initPreparedStatements()

  log("INFO", "Database initialized successfully")
}

// Subscription status type for queries
export interface UserSubscriptionStatus {
  subscription_status: string
  subscription_id: string | null
  subscription_current_period_end: string | null
  razorpay_customer_id: string | null
  first_order_id: number | null
  owns_trmnl_device: number
}

// Prepared statements (initialized after tables exist)
let _userQueries: {
  findByEmail: Statement<User, [string]>
  findById: Statement<User, [number]>
  create: Statement<User, [string, string, string | null]>
  updatePassword: Statement<void, [string, number]>
  updateSettings: Statement<void, [string | null, string | null, string, number]>
  getSettings: Statement<UserSettings, [number]>
  getSubscriptionStatus: Statement<UserSubscriptionStatus, [number]>
  updateRazorpayCustomerId: Statement<void, [string, number]>
  updateSubscription: Statement<void, [string, string, string | null, number]>
  updateSubscriptionStatus: Statement<void, [string, number]>
  updateFirstOrderId: Statement<void, [number, number]>
  findBySubscriptionId: Statement<{ id: number }, [string]>
  findByRazorpayCustomerId: Statement<{ id: number }, [string]>
  setOwnsTrmnlDevice: Statement<void, [number, number]>
}

let _syncedImageQueries: {
  findLatestByUserId: Statement<SyncedImage, [number]>
  findAllByUserId: Statement<SyncedImage, [number]>
  create: Statement<SyncedImage, [number, string, string | null]>
  deleteByUserId: Statement<void, [number]>
}

let _generatedImageQueries: {
  findById: Statement<GeneratedImage, [number]>
  findByIdAndUserId: Statement<GeneratedImage, [number, number]>
  findAllByUserId: Statement<GeneratedImage, [number, number, number]>
  findFavoritesByUserId: Statement<GeneratedImage, [number, number, number]>
  countByUserId: Statement<{ count: number }, [number]>
  countFavoritesByUserId: Statement<{ count: number }, [number]>
  create: Statement<GeneratedImage, [number, string, string, string | null, string, string, string | null, number, number | null]>
  updateFavorite: Statement<void, [number, number, number]>
  softDelete: Statement<void, [number, number]>
  updateImageUrl: Statement<void, [string, number]>
  search: Statement<GeneratedImage, [number, string, string, number, number]>
}

let _orderQueries: {
  findById: Statement<Order, [number]>
  findByIdAndUserId: Statement<Order, [number, number]>
  findByOrderNumber: Statement<Order, [string]>
  findByRazorpayOrderId: Statement<Order, [string]>
  findAllByUserId: Statement<Order, [number]>
  findPaidByUserId: Statement<Order, [number]>
  countPaidByUserId: Statement<{ count: number }, [number]>
  create: Statement<Order, [number, string, number, number, number, string, string, string | null, string, string, string | null, string, string, string, string, number, string | null, string | null]>
  updateRazorpayOrderId: Statement<void, [string, number]>
  updatePayment: Statement<void, [string, number]>
  updateStatus: Statement<void, [string, number]>
  updateTracking: Statement<void, [string, string, string | null, number]>
}

let _scheduledJobQueries: {
  findById: Statement<ScheduledJob, [number]>
  findByIdAndUserId: Statement<ScheduledJob, [number, number]>
  findAllByUserId: Statement<ScheduledJob, [number]>
  findAllByUserIdPaginated: Statement<ScheduledJob, [number, number, number]>
  findDueJobs: Statement<ScheduledJob, [string]>
  countByUserId: Statement<{ count: number }, [number]>
  create: Statement<ScheduledJob, [number, string, string, string | null, string, string, string | null, string | null, string, number, number, string | null]>
  update: Statement<void, [string, string, string | null, string, string, string | null, string | null, string, number, number, string | null, number, number]>
  updateEnabled: Statement<void, [number, number, number]>
  updateLastRun: Statement<void, [string, string | null, number]>
  delete: Statement<void, [number, number]>
}

let _batchJobQueries: {
  findById: Statement<BatchJob, [number]>
  findByIdAndUserId: Statement<BatchJob, [number, number]>
  findAllByUserId: Statement<BatchJob, [number]>
  findAllByUserIdPaginated: Statement<BatchJob, [number, number, number]>
  countByUserId: Statement<{ count: number }, [number]>
  findPending: Statement<BatchJob, []>
  create: Statement<BatchJob, [number, string | null, number, string, string | null, number]>
  updateStatus: Statement<void, [string, number]>
  updateProgress: Statement<void, [number, number, number]>
  incrementCompleted: Statement<void, [number]>
  incrementFailed: Statement<void, [number]>
  updateStarted: Statement<void, [number]>
  updateCompleted: Statement<void, [string, number]>
  delete: Statement<void, [number, number]>
}

let _batchJobItemQueries: {
  findByBatchId: Statement<BatchJobItem, [number]>
  findPendingByBatchId: Statement<BatchJobItem, [number]>
  create: Statement<BatchJobItem, [number, string]>
  updateStatus: Statement<void, [string, number | null, string | null, number]>
  updateCompleted: Statement<void, [string, number | null, string | null, number]>
  markSyncedToTrmnl: Statement<void, [number]>
}

let _passwordResetTokenQueries: {
  create: Statement<PasswordResetToken, [number, string, string]>
  findByToken: Statement<PasswordResetToken, [string, string]>
  markAsUsed: Statement<void, [number]>
  deleteExpired: Statement<void, [string]>
  deleteByUserId: Statement<void, [number]>
}

let _tokenBlacklistQueries: {
  findByJti: Statement<TokenBlacklist, [string]>
  create: Statement<TokenBlacklist, [string, number, string, string | null]>
  deleteExpired: Statement<void, [string]>
}

let _refreshTokenQueries: {
  findByTokenHash: Statement<RefreshToken, [string]>
  findByJti: Statement<RefreshToken, [string]>
  findAllByUserId: Statement<RefreshToken, [number]>
  create: Statement<RefreshToken, [number, string, string, string, string | null, string | null]>
  updateLastUsed: Statement<void, [string, number]>
  revoke: Statement<void, [number]>
  revokeAllByUserId: Statement<void, [number]>
  deleteExpired: Statement<void, [string]>
}

let _userDeviceQueries: {
  findById: Statement<UserDevice, [number]>
  findByIdAndUserId: Statement<UserDevice, [number, number]>
  findAllByUserId: Statement<UserDevice, [number]>
  findDefaultByUserId: Statement<UserDevice, [number]>
  findByWebhookUuid: Statement<UserDevice, [string]>
  countByUserId: Statement<{ count: number }, [number]>
  create: Statement<UserDevice, [number, string, string, string, number, string | null, string | null]>
  update: Statement<void, [string, string, string, string | null, string | null, number]>
  setDefault: Statement<void, [number, number]>
  clearDefault: Statement<void, [number]>
  delete: Statement<void, [number, number]>
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
    updateSettings: db.prepare<void, [string | null, string | null, string, number]>(
      "UPDATE users SET trmnl_device_api_key = ?, trmnl_mac_address = ?, trmnl_background_color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    getSettings: db.prepare<UserSettings, [number]>(
      "SELECT trmnl_device_api_key, trmnl_mac_address, COALESCE(trmnl_background_color, 'black') as trmnl_background_color FROM users WHERE id = ?"
    ),
    getSubscriptionStatus: db.prepare<UserSubscriptionStatus, [number]>(
      "SELECT COALESCE(subscription_status, 'none') as subscription_status, subscription_id, subscription_current_period_end, razorpay_customer_id, first_order_id, COALESCE(owns_trmnl_device, 0) as owns_trmnl_device FROM users WHERE id = ?"
    ),
    updateRazorpayCustomerId: db.prepare<void, [string, number]>(
      "UPDATE users SET razorpay_customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    updateSubscription: db.prepare<void, [string, string, string | null, number]>(
      "UPDATE users SET subscription_id = ?, subscription_status = ?, subscription_current_period_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    updateSubscriptionStatus: db.prepare<void, [string, number]>(
      "UPDATE users SET subscription_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    updateFirstOrderId: db.prepare<void, [number, number]>(
      "UPDATE users SET first_order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    findBySubscriptionId: db.prepare<{ id: number }, [string]>(
      "SELECT id FROM users WHERE subscription_id = ?"
    ),
    findByRazorpayCustomerId: db.prepare<{ id: number }, [string]>(
      "SELECT id FROM users WHERE razorpay_customer_id = ?"
    ),
    setOwnsTrmnlDevice: db.prepare<void, [number, number]>(
      "UPDATE users SET owns_trmnl_device = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
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

  _generatedImageQueries = {
    findById: db.prepare<GeneratedImage, [number]>(
      "SELECT * FROM generated_images WHERE id = ? AND is_deleted = 0"
    ),
    findByIdAndUserId: db.prepare<GeneratedImage, [number, number]>(
      "SELECT * FROM generated_images WHERE id = ? AND user_id = ? AND is_deleted = 0"
    ),
    findAllByUserId: db.prepare<GeneratedImage, [number, number, number]>(
      "SELECT * FROM generated_images WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ),
    findFavoritesByUserId: db.prepare<GeneratedImage, [number, number, number]>(
      "SELECT * FROM generated_images WHERE user_id = ? AND is_favorite = 1 AND is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ),
    countByUserId: db.prepare<{ count: number }, [number]>(
      "SELECT COUNT(*) as count FROM generated_images WHERE user_id = ? AND is_deleted = 0"
    ),
    countFavoritesByUserId: db.prepare<{ count: number }, [number]>(
      "SELECT COUNT(*) as count FROM generated_images WHERE user_id = ? AND is_favorite = 1 AND is_deleted = 0"
    ),
    create: db.prepare<GeneratedImage, [number, string, string, string | null, string, string, string | null, number, number | null]>(
      "INSERT INTO generated_images (user_id, image_url, original_prompt, revised_prompt, model, size, style, is_edit, parent_image_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
    ),
    updateFavorite: db.prepare<void, [number, number, number]>(
      "UPDATE generated_images SET is_favorite = ? WHERE id = ? AND user_id = ?"
    ),
    softDelete: db.prepare<void, [number, number]>(
      "UPDATE generated_images SET is_deleted = 1 WHERE id = ? AND user_id = ?"
    ),
    updateImageUrl: db.prepare<void, [string, number]>(
      "UPDATE generated_images SET image_url = ? WHERE id = ?"
    ),
    search: db.prepare<GeneratedImage, [number, string, string, number, number]>(
      "SELECT * FROM generated_images WHERE user_id = ? AND is_deleted = 0 AND (original_prompt LIKE ? OR revised_prompt LIKE ?) ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ),
  }

  _orderQueries = {
    findById: db.prepare<Order, [number]>(
      "SELECT * FROM orders WHERE id = ?"
    ),
    findByIdAndUserId: db.prepare<Order, [number, number]>(
      "SELECT * FROM orders WHERE id = ? AND user_id = ?"
    ),
    findByOrderNumber: db.prepare<Order, [string]>(
      "SELECT * FROM orders WHERE order_number = ?"
    ),
    findByRazorpayOrderId: db.prepare<Order, [string]>(
      "SELECT * FROM orders WHERE razorpay_order_id = ?"
    ),
    findAllByUserId: db.prepare<Order, [number]>(
      "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC"
    ),
    findPaidByUserId: db.prepare<Order, [number]>(
      "SELECT * FROM orders WHERE user_id = ? AND status != 'pending' AND status != 'cancelled' ORDER BY created_at DESC"
    ),
    countPaidByUserId: db.prepare<{ count: number }, [number]>(
      "SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status != 'pending' AND status != 'cancelled'"
    ),
    create: db.prepare<Order, [number, string, number, number, number, string, string, string | null, string, string, string | null, string, string, string, string, number, string | null, string | null]>(
      `INSERT INTO orders (
        user_id, order_number, quantity, unit_price, total_amount, currency,
        shipping_name, shipping_email, shipping_phone, shipping_address_line1,
        shipping_address_line2, shipping_city, shipping_state, shipping_postal_code,
        shipping_country, is_gift, gift_recipient_name, gift_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    ),
    updateRazorpayOrderId: db.prepare<void, [string, number]>(
      "UPDATE orders SET razorpay_order_id = ? WHERE id = ?"
    ),
    updatePayment: db.prepare<void, [string, number]>(
      "UPDATE orders SET razorpay_payment_id = ?, status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    updateStatus: db.prepare<void, [string, number]>(
      "UPDATE orders SET status = ? WHERE id = ?"
    ),
    updateTracking: db.prepare<void, [string, string, string | null, number]>(
      "UPDATE orders SET tracking_number = ?, carrier = ?, tracking_url = ?, status = 'shipped', shipped_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
  }

  _scheduledJobQueries = {
    findById: db.prepare<ScheduledJob, [number]>(
      "SELECT * FROM scheduled_jobs WHERE id = ?"
    ),
    findByIdAndUserId: db.prepare<ScheduledJob, [number, number]>(
      "SELECT * FROM scheduled_jobs WHERE id = ? AND user_id = ?"
    ),
    findAllByUserId: db.prepare<ScheduledJob, [number]>(
      "SELECT * FROM scheduled_jobs WHERE user_id = ? ORDER BY created_at DESC"
    ),
    findAllByUserIdPaginated: db.prepare<ScheduledJob, [number, number, number]>(
      "SELECT * FROM scheduled_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ),
    findDueJobs: db.prepare<ScheduledJob, [string]>(
      "SELECT * FROM scheduled_jobs WHERE is_enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?"
    ),
    countByUserId: db.prepare<{ count: number }, [number]>(
      "SELECT COUNT(*) as count FROM scheduled_jobs WHERE user_id = ?"
    ),
    create: db.prepare<ScheduledJob, [number, string, string, string | null, string, string, string | null, string | null, string, number, number, string | null]>(
      `INSERT INTO scheduled_jobs (
        user_id, prompt, size, style_preset, schedule_type, schedule_time,
        schedule_days, scheduled_at, timezone, is_enabled, auto_sync_trmnl, next_run_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    ),
    update: db.prepare<void, [string, string, string | null, string, string, string | null, string | null, string, number, number, string | null, number, number]>(
      `UPDATE scheduled_jobs SET 
        prompt = ?, size = ?, style_preset = ?, schedule_type = ?, schedule_time = ?,
        schedule_days = ?, scheduled_at = ?, timezone = ?, is_enabled = ?, auto_sync_trmnl = ?,
        next_run_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?`
    ),
    updateEnabled: db.prepare<void, [number, number, number]>(
      "UPDATE scheduled_jobs SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
    ),
    updateLastRun: db.prepare<void, [string, string | null, number]>(
      "UPDATE scheduled_jobs SET last_run_at = ?, next_run_at = ?, run_count = run_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    delete: db.prepare<void, [number, number]>(
      "DELETE FROM scheduled_jobs WHERE id = ? AND user_id = ?"
    ),
  }

  _batchJobQueries = {
    findById: db.prepare<BatchJob, [number]>(
      "SELECT * FROM batch_jobs WHERE id = ?"
    ),
    findByIdAndUserId: db.prepare<BatchJob, [number, number]>(
      "SELECT * FROM batch_jobs WHERE id = ? AND user_id = ?"
    ),
    findAllByUserId: db.prepare<BatchJob, [number]>(
      "SELECT * FROM batch_jobs WHERE user_id = ? ORDER BY created_at DESC"
    ),
    findAllByUserIdPaginated: db.prepare<BatchJob, [number, number, number]>(
      "SELECT * FROM batch_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ),
    countByUserId: db.prepare<{ count: number }, [number]>(
      "SELECT COUNT(*) as count FROM batch_jobs WHERE user_id = ?"
    ),
    findPending: db.prepare<BatchJob, []>(
      "SELECT * FROM batch_jobs WHERE status = 'pending' OR status = 'processing' ORDER BY created_at ASC LIMIT 1"
    ),
    create: db.prepare<BatchJob, [number, string | null, number, string, string | null, number]>(
      "INSERT INTO batch_jobs (user_id, name, total_count, size, style_preset, auto_sync_trmnl) VALUES (?, ?, ?, ?, ?, ?) RETURNING *"
    ),
    updateStatus: db.prepare<void, [string, number]>(
      "UPDATE batch_jobs SET status = ? WHERE id = ?"
    ),
    updateProgress: db.prepare<void, [number, number, number]>(
      "UPDATE batch_jobs SET completed_count = ?, failed_count = ? WHERE id = ?"
    ),
    incrementCompleted: db.prepare<void, [number]>(
      "UPDATE batch_jobs SET completed_count = completed_count + 1 WHERE id = ?"
    ),
    incrementFailed: db.prepare<void, [number]>(
      "UPDATE batch_jobs SET failed_count = failed_count + 1 WHERE id = ?"
    ),
    updateStarted: db.prepare<void, [number]>(
      "UPDATE batch_jobs SET status = 'processing', started_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    updateCompleted: db.prepare<void, [string, number]>(
      "UPDATE batch_jobs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    delete: db.prepare<void, [number, number]>(
      "DELETE FROM batch_jobs WHERE id = ? AND user_id = ?"
    ),
  }

  _batchJobItemQueries = {
    findByBatchId: db.prepare<BatchJobItem, [number]>(
      "SELECT * FROM batch_job_items WHERE batch_id = ? ORDER BY id ASC"
    ),
    findPendingByBatchId: db.prepare<BatchJobItem, [number]>(
      // Include 'processing' items in case server crashed mid-processing
      "SELECT * FROM batch_job_items WHERE batch_id = ? AND (status = 'pending' OR status = 'processing') ORDER BY id ASC LIMIT 1"
    ),
    create: db.prepare<BatchJobItem, [number, string]>(
      "INSERT INTO batch_job_items (batch_id, prompt) VALUES (?, ?) RETURNING *"
    ),
    updateStatus: db.prepare<void, [string, number | null, string | null, number]>(
      "UPDATE batch_job_items SET status = ?, image_id = ?, error_message = ? WHERE id = ?"
    ),
    updateCompleted: db.prepare<void, [string, number | null, string | null, number]>(
      "UPDATE batch_job_items SET status = ?, image_id = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    markSyncedToTrmnl: db.prepare<void, [number]>(
      "UPDATE batch_job_items SET synced_to_trmnl = 1 WHERE id = ?"
    ),
  }

  _passwordResetTokenQueries = {
    create: db.prepare<PasswordResetToken, [number, string, string]>(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?) RETURNING *"
    ),
    findByToken: db.prepare<PasswordResetToken, [string, string]>(
      "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > ?"
    ),
    markAsUsed: db.prepare<void, [number]>(
      "UPDATE password_reset_tokens SET used = 1 WHERE id = ?"
    ),
    deleteExpired: db.prepare<void, [string]>(
      "DELETE FROM password_reset_tokens WHERE expires_at < ?"
    ),
    deleteByUserId: db.prepare<void, [number]>(
      "DELETE FROM password_reset_tokens WHERE user_id = ?"
    ),
  }

  _tokenBlacklistQueries = {
    findByJti: db.prepare<TokenBlacklist, [string]>(
      "SELECT * FROM token_blacklist WHERE jti = ?"
    ),
    create: db.prepare<TokenBlacklist, [string, number, string, string | null]>(
      "INSERT INTO token_blacklist (jti, user_id, expires_at, reason) VALUES (?, ?, ?, ?) RETURNING *"
    ),
    deleteExpired: db.prepare<void, [string]>(
      "DELETE FROM token_blacklist WHERE expires_at < ?"
    ),
  }

  _refreshTokenQueries = {
    findByTokenHash: db.prepare<RefreshToken, [string]>(
      "SELECT * FROM refresh_tokens WHERE token_hash = ? AND is_revoked = 0"
    ),
    findByJti: db.prepare<RefreshToken, [string]>(
      "SELECT * FROM refresh_tokens WHERE jti = ? AND is_revoked = 0"
    ),
    findAllByUserId: db.prepare<RefreshToken, [number]>(
      "SELECT * FROM refresh_tokens WHERE user_id = ? AND is_revoked = 0 ORDER BY created_at DESC"
    ),
    create: db.prepare<RefreshToken, [number, string, string, string, string | null, string | null]>(
      "INSERT INTO refresh_tokens (user_id, token_hash, jti, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?) RETURNING *"
    ),
    updateLastUsed: db.prepare<void, [string, number]>(
      "UPDATE refresh_tokens SET last_used_at = ? WHERE id = ?"
    ),
    revoke: db.prepare<void, [number]>(
      "UPDATE refresh_tokens SET is_revoked = 1, revoked_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    revokeAllByUserId: db.prepare<void, [number]>(
      "UPDATE refresh_tokens SET is_revoked = 1, revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_revoked = 0"
    ),
    deleteExpired: db.prepare<void, [string]>(
      "DELETE FROM refresh_tokens WHERE expires_at < ?"
    ),
  }

  _userDeviceQueries = {
    findById: db.prepare<UserDevice, [number]>(
      "SELECT * FROM user_devices WHERE id = ?"
    ),
    findByIdAndUserId: db.prepare<UserDevice, [number, number]>(
      "SELECT * FROM user_devices WHERE id = ? AND user_id = ?"
    ),
    findAllByUserId: db.prepare<UserDevice, [number]>(
      "SELECT * FROM user_devices WHERE user_id = ? ORDER BY is_default DESC, created_at ASC"
    ),
    findDefaultByUserId: db.prepare<UserDevice, [number]>(
      "SELECT * FROM user_devices WHERE user_id = ? AND is_default = 1 LIMIT 1"
    ),
    findByWebhookUuid: db.prepare<UserDevice, [string]>(
      "SELECT * FROM user_devices WHERE webhook_uuid = ?"
    ),
    countByUserId: db.prepare<{ count: number }, [number]>(
      "SELECT COUNT(*) as count FROM user_devices WHERE user_id = ?"
    ),
    create: db.prepare<UserDevice, [number, string, string, string, number, string | null, string | null]>(
      "INSERT INTO user_devices (user_id, name, webhook_uuid, background_color, is_default, mac_address, device_api_key) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *"
    ),
    update: db.prepare<void, [string, string, string, string | null, string | null, number]>(
      "UPDATE user_devices SET name = ?, webhook_uuid = ?, background_color = ?, mac_address = ?, device_api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ),
    setDefault: db.prepare<void, [number, number]>(
      "UPDATE user_devices SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
    ),
    clearDefault: db.prepare<void, [number]>(
      "UPDATE user_devices SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
    ),
    delete: db.prepare<void, [number, number]>(
      "DELETE FROM user_devices WHERE id = ? AND user_id = ?"
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
  get getSubscriptionStatus() { return _userQueries.getSubscriptionStatus },
  get updateRazorpayCustomerId() { return _userQueries.updateRazorpayCustomerId },
  get updateSubscription() { return _userQueries.updateSubscription },
  get updateSubscriptionStatus() { return _userQueries.updateSubscriptionStatus },
  get updateFirstOrderId() { return _userQueries.updateFirstOrderId },
  get findBySubscriptionId() { return _userQueries.findBySubscriptionId },
  get findByRazorpayCustomerId() { return _userQueries.findByRazorpayCustomerId },
  get setOwnsTrmnlDevice() { return _userQueries.setOwnsTrmnlDevice },
}

export const syncedImageQueries = {
  get findLatestByUserId() { return _syncedImageQueries.findLatestByUserId },
  get findAllByUserId() { return _syncedImageQueries.findAllByUserId },
  get create() { return _syncedImageQueries.create },
  get deleteByUserId() { return _syncedImageQueries.deleteByUserId },
}

export const generatedImageQueries = {
  get findById() { return _generatedImageQueries.findById },
  get findByIdAndUserId() { return _generatedImageQueries.findByIdAndUserId },
  get findAllByUserId() { return _generatedImageQueries.findAllByUserId },
  get findFavoritesByUserId() { return _generatedImageQueries.findFavoritesByUserId },
  get countByUserId() { return _generatedImageQueries.countByUserId },
  get countFavoritesByUserId() { return _generatedImageQueries.countFavoritesByUserId },
  get create() { return _generatedImageQueries.create },
  get updateFavorite() { return _generatedImageQueries.updateFavorite },
  get softDelete() { return _generatedImageQueries.softDelete },
  get updateImageUrl() { return _generatedImageQueries.updateImageUrl },
  get search() { return _generatedImageQueries.search },
}

export const orderQueries = {
  get findById() { return _orderQueries.findById },
  get findByIdAndUserId() { return _orderQueries.findByIdAndUserId },
  get findByOrderNumber() { return _orderQueries.findByOrderNumber },
  get findByRazorpayOrderId() { return _orderQueries.findByRazorpayOrderId },
  get findAllByUserId() { return _orderQueries.findAllByUserId },
  get findPaidByUserId() { return _orderQueries.findPaidByUserId },
  get countPaidByUserId() { return _orderQueries.countPaidByUserId },
  get create() { return _orderQueries.create },
  get updateRazorpayOrderId() { return _orderQueries.updateRazorpayOrderId },
  get updatePayment() { return _orderQueries.updatePayment },
  get updateStatus() { return _orderQueries.updateStatus },
  get updateTracking() { return _orderQueries.updateTracking },
}

export const scheduledJobQueries = {
  get findById() { return _scheduledJobQueries.findById },
  get findByIdAndUserId() { return _scheduledJobQueries.findByIdAndUserId },
  get findAllByUserId() { return _scheduledJobQueries.findAllByUserId },
  get findAllByUserIdPaginated() { return _scheduledJobQueries.findAllByUserIdPaginated },
  get findDueJobs() { return _scheduledJobQueries.findDueJobs },
  get countByUserId() { return _scheduledJobQueries.countByUserId },
  get create() { return _scheduledJobQueries.create },
  get update() { return _scheduledJobQueries.update },
  get updateEnabled() { return _scheduledJobQueries.updateEnabled },
  get updateLastRun() { return _scheduledJobQueries.updateLastRun },
  get delete() { return _scheduledJobQueries.delete },
}

export const batchJobQueries = {
  get findById() { return _batchJobQueries.findById },
  get findByIdAndUserId() { return _batchJobQueries.findByIdAndUserId },
  get findAllByUserId() { return _batchJobQueries.findAllByUserId },
  get findAllByUserIdPaginated() { return _batchJobQueries.findAllByUserIdPaginated },
  get countByUserId() { return _batchJobQueries.countByUserId },
  get findPending() { return _batchJobQueries.findPending },
  get create() { return _batchJobQueries.create },
  get updateStatus() { return _batchJobQueries.updateStatus },
  get updateProgress() { return _batchJobQueries.updateProgress },
  get incrementCompleted() { return _batchJobQueries.incrementCompleted },
  get incrementFailed() { return _batchJobQueries.incrementFailed },
  get updateStarted() { return _batchJobQueries.updateStarted },
  get updateCompleted() { return _batchJobQueries.updateCompleted },
  get delete() { return _batchJobQueries.delete },
}

export const batchJobItemQueries = {
  get findByBatchId() { return _batchJobItemQueries.findByBatchId },
  get findPendingByBatchId() { return _batchJobItemQueries.findPendingByBatchId },
  get create() { return _batchJobItemQueries.create },
  get updateStatus() { return _batchJobItemQueries.updateStatus },
  get updateCompleted() { return _batchJobItemQueries.updateCompleted },
  get markSyncedToTrmnl() { return _batchJobItemQueries.markSyncedToTrmnl },
}

export const passwordResetTokenQueries = {
  get create() { return _passwordResetTokenQueries.create },
  get findByToken() { return _passwordResetTokenQueries.findByToken },
  get markAsUsed() { return _passwordResetTokenQueries.markAsUsed },
  get deleteExpired() { return _passwordResetTokenQueries.deleteExpired },
  get deleteByUserId() { return _passwordResetTokenQueries.deleteByUserId },
}

export const tokenBlacklistQueries = {
  get findByJti() { return _tokenBlacklistQueries.findByJti },
  get create() { return _tokenBlacklistQueries.create },
  get deleteExpired() { return _tokenBlacklistQueries.deleteExpired },
}

export const refreshTokenQueries = {
  get findByTokenHash() { return _refreshTokenQueries.findByTokenHash },
  get findByJti() { return _refreshTokenQueries.findByJti },
  get findAllByUserId() { return _refreshTokenQueries.findAllByUserId },
  get create() { return _refreshTokenQueries.create },
  get updateLastUsed() { return _refreshTokenQueries.updateLastUsed },
  get revoke() { return _refreshTokenQueries.revoke },
  get revokeAllByUserId() { return _refreshTokenQueries.revokeAllByUserId },
  get deleteExpired() { return _refreshTokenQueries.deleteExpired },
}

export const userDeviceQueries = {
  get findById() { return _userDeviceQueries.findById },
  get findByIdAndUserId() { return _userDeviceQueries.findByIdAndUserId },
  get findAllByUserId() { return _userDeviceQueries.findAllByUserId },
  get findDefaultByUserId() { return _userDeviceQueries.findDefaultByUserId },
  get findByWebhookUuid() { return _userDeviceQueries.findByWebhookUuid },
  get countByUserId() { return _userDeviceQueries.countByUserId },
  get create() { return _userDeviceQueries.create },
  get update() { return _userDeviceQueries.update },
  get setDefault() { return _userDeviceQueries.setDefault },
  get clearDefault() { return _userDeviceQueries.clearDefault },
  get delete() { return _userDeviceQueries.delete },
}
