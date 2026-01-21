# PromptInk Changelog

## Recent Changes and Fixes

### AI Prompt Enhancement Feature
**Date:** June 2025

**Features Added:**
- **AI Prompt Enhancement:** When users submit a prompt for image generation, an AI-powered modal shows both the original and an enhanced version
- **User Choice:** Users can choose to use their original prompt or the AI-enhanced version with more artistic details
- **Smart Enhancement:** Uses GPT-4o-mini to add lighting, atmosphere, composition, and style details to prompts
- **Bilingual Support:** Full English and Chinese translations for the enhancement modal

**Changes:**
- Added `enhancePrompt` function to OpenAI service using GPT-4o-mini
- Added `/api/prompt/enhance` POST endpoint (authenticated)
- Created `PromptEnhanceModal` component with side-by-side comparison
- Modified `handleSend` flow to show enhancement modal for regular prompts (not image edits or infographics)

**Files Modified:**
- `backend/src/services/openai-service.ts` - Added `enhancePrompt` function
- `backend/src/routes/prompt.ts` - New route file for prompt enhancement
- `backend/src/routes/index.ts` - Added prompt routes
- `frontend/src/components/PromptEnhanceModal.tsx` - New modal component
- `frontend/src/components/index.ts` - Export modal
- `frontend/src/App.tsx` - Modal integration and flow logic
- `frontend/src/hooks/useLanguage.ts` - Added translations

---

### Multi-Device TRMNL Sync & Admin Device Management
**Commit:** `45b78d0`

**Features Added:**
- **Multi-Device Support:** Users can configure multiple TRMNL devices with individual webhook URLs
- **Device Selector:** When syncing with multiple devices, a dropdown lets you choose which devices to sync to
- **Admin Device Management:** Admins can now manage devices for any user from the Admin page
  - View all devices for a user
  - Add/edit/delete devices
  - Set MAC Address and Device API Key (admin-only fields)
  - Set default device

**Changes:**
- Sync now sends payload directly to device webhook URLs (removed MAC address/API key TRMNL API calls)
- Sync button is disabled when no devices with webhook URLs are configured
- `useTrmnlSync` hook now fetches and exposes user's device list

**Files Modified:**
- `backend/src/db/index.ts` - Added mac_address/device_api_key columns
- `backend/src/routes/admin.ts` - Added admin device CRUD endpoints
- `backend/src/routes/devices.ts` - Updated device response format
- `backend/src/routes/sync.ts` - Simplified to webhook-only sync
- `frontend/src/App.tsx` - Conditional sync button visibility
- `frontend/src/components/ImageDetailModal.tsx` - Multi-device selector UI
- `frontend/src/hooks/useTrmnlSync.ts` - Device fetching and multi-device sync
- `frontend/src/pages/AdminPage.tsx` - Admin device management modal

---

### Mobile Chrome Scroll Fix
**Commit:** `7dee68a`

**Problem:** App wouldn't scroll on mobile Chrome browser.

**Root Cause:**
- `100vh` on mobile browsers includes the hidden URL bar space
- `overflow-hidden` on main content prevented vertical scrolling
- Missing touch scroll support for iOS

**Solution:**
- Added `100dvh` (dynamic viewport height) with `100vh` fallback
- Enabled touch scrolling with `-webkit-overflow-scrolling: touch`
- Changed main content from `overflow-hidden` to `overflow-x-hidden overflow-y-auto`
- Added `viewport-fit=cover` for notched devices

**Files Modified:**
- `frontend/index.html`
- `frontend/index.prod.html`
- `frontend/src/App.tsx`

---

### Image Gallery Feature
**Commit:** `a240d3b`

**Features Added:**
- New Gallery page to view all generated images
- Image detail modal with navigation
- Favorite/unfavorite functionality
- Search and filter capabilities
- Share functionality for images

**Files Added:**
- `frontend/src/pages/GalleryPage.tsx`
- `frontend/src/components/GalleryCard.tsx`
- `frontend/src/components/ImageDetailModal.tsx`
- `frontend/src/components/ShareButton.tsx`
- `frontend/src/hooks/useGallery.ts`
- `backend/src/routes/gallery.ts`
- `backend/src/routes/share.ts`

---

### GST Pricing Fix
**Commits:** `f8e8e6e`, `ac07477`

**Problem:**
- Purchase page total was incorrect (120 + 5.99 ≠ 120)
- Singapore GST (9%) was not included
- Monthly subscription didn't include GST

**Solution:**
- Added GST calculation (9%) for frame purchases
- Added GST to monthly subscription fee ($5.99 + 9% = $6.53)
- Updated order summary to show all components

**Pricing Structure:**
```
Frame Price:     $120.00 per unit
Frame GST (9%):  $10.80 per unit
Subscription:    $6.53/month (incl. GST)
─────────────────────────────────
Total (1 frame): $137.33 (first-time subscriber)
```

**Files Modified:**
- `frontend/src/pages/PurchasePage.tsx`
- `frontend/src/hooks/useLanguage.ts`

---

### TRMNL Plugin Configuration
**Commits:** `ae7db90`, `2675172`

**Problem:**
- Custom fields weren't being recognized by TRMNL
- Wrong field format was being used

**Solution:**
- Updated to correct TRMNL format: `keyname`, `name`, `field_type`
- Configured all merge_variables for webhook

**Custom Fields:**
```yaml
custom_fields:
  - keyname: image_url
    name: Image URL
    field_type: text
  - keyname: has_image
    name: Has Image
    field_type: text
  - keyname: prompt
    name: Prompt
    field_type: text
  - keyname: background_color
    name: Background Color
    field_type: text
  - keyname: updated_at
    name: Updated At
    field_type: text
```

**Files Modified:**
- `trmnl-plugin/src/settings.yml`

---

### Image Loading Fix
**Commits:** `72d2792`, `fec32f8`

**Problem:**
- Product image not showing on purchase page
- Image had wrong extension (.jpg but was actually PNG)
- Backend wasn't serving images with correct Content-Type

**Solution:**
- Renamed `1000091170.jpg` to `1000091170.png`
- Added `publicPath: "/assets/"` to build configuration
- Added proper Content-Type headers for images in backend

**Files Modified:**
- `frontend/src/assets/1000091170.png` (renamed)
- `frontend/src/pages/PurchasePage.tsx`
- `frontend/build.ts`
- `backend/src/index.ts`

---

### Chinese Language Support
**Commits:** `478e8ea`, `4c67b62`

**Problem:** Subscription, orders, and purchase pages didn't support Chinese language.

**Solution:**
Added full Chinese translations for:
- Subscription page (status labels, buttons, messages)
- Orders page (status labels, headers, timestamps)
- Purchase page (form fields, pricing, errors)

**Translation Keys Added:**
```typescript
// Subscription
subscription: {
  title: "订阅",
  subtitle: "管理您的 PromptInk 订阅",
  // ... full translations
}

// Orders
orders: {
  title: "我的订单",
  // ... full translations
}

// Purchase
purchase: {
  title: "TRMNL 相框",
  gst: "消费税 (9%)",
  inclGst: "含消费税",
  // ... full translations
}
```

**Files Modified:**
- `frontend/src/hooks/useLanguage.ts`
- `frontend/src/pages/SubscriptionPage.tsx`
- `frontend/src/pages/OrdersPage.tsx`
- `frontend/src/pages/PurchasePage.tsx`

---

### Product Image on Purchase Page
**Commit:** `40f3b5c`

**Feature:** Added Pikachu-themed AI-powered e-ink photo frame image to the purchase page.

**Files Modified:**
- `frontend/src/assets/1000091170.png` (added)
- `frontend/src/pages/PurchasePage.tsx`

---

### Purchase Flow with Razorpay
**Commit:** `0c7df4b`

**Features Added:**
- Complete purchase flow for TRMNL photo frame
- Razorpay payment integration
- Order creation and verification
- Skip option for users who want to explore first

**Files Added/Modified:**
- `frontend/src/pages/PurchasePage.tsx`
- `frontend/src/pages/OrderConfirmationPage.tsx`
- Backend payment routes

---

### TRMNL Background Color Toggle
**Commit:** `2fc82b6`

**Feature:** Added setting to toggle TRMNL display background color between black and white.

**Files Modified:**
- `frontend/src/pages/SettingsPage.tsx`
- Backend settings routes

---

## API Endpoints

### TRMNL Webhook
```bash
POST https://usetrmnl.com/api/custom_plugins/188f0d1b-f862-4663-81aa-827e30e7217e

# Request body
{
  "merge_variables": {
    "image_url": "https://example.com/image.png",
    "has_image": "true",
    "prompt": "Image description",
    "background_color": "black",
    "updated_at": "2026-01-16T10:30:00Z"
  }
}

# Response
{
  "message": null,
  "merge_variables": { ... }
}
```

---

## Configuration

### TRMNL Plugin Settings
**File:** `trmnl-plugin/src/settings.yml`

```yaml
strategy: webhook
polling_url: https://promptink-production.up.railway.app/api/trmnl/webhook/1
name: PromptInk
refresh_interval: 15
```

### Build Configuration
**File:** `frontend/build.ts`

```typescript
await build({
  entrypoints: ["./src/index.tsx"],
  outdir: "./dist",
  target: "browser",
  format: "esm",
  splitting: true,
  minify: true,
  sourcemap: "external",
  publicPath: "/assets/",
})
```

---

## Mobile Optimizations

### CSS Fixes Applied
```css
/* Dynamic viewport height */
html { height: 100%; }
body { min-height: 100%; min-height: 100dvh; }

/* Touch scrolling */
.scroll-touch {
  -webkit-overflow-scrolling: touch;
  overflow-y: auto;
}

/* Fix h-screen on mobile */
.h-screen {
  height: 100vh;
  height: 100dvh;
}
```

### Viewport Meta Tag
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```
