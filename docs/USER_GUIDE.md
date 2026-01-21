# PromptInk User Guide

Welcome to PromptInk! This guide will help you get the most out of AI-powered image generation with TRMNL e-ink display sync.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Images](#creating-images)
3. [Image Editing](#image-editing)
4. [Infographics](#infographics)
5. [Gallery](#gallery)
6. [Scheduled Generation](#scheduled-generation)
7. [Batch Generation](#batch-generation)
8. [TRMNL Sync](#trmnl-sync)
9. [Settings](#settings)
10. [Orders & Subscription](#orders--subscription)
11. [Tips & Tricks](#tips--tricks)

---

## Getting Started

### Creating an Account

1. Navigate to the PromptInk app
2. Click **Register** to create a new account
3. Enter your email address and choose a secure password (minimum 8 characters)
4. Optionally, add your name
5. Click **Create Account**

### Logging In

1. Enter your registered email and password
2. Click **Sign In**

### Forgot Password?

1. Click **Forgot password?** on the login page
2. Enter your email address
3. Check your inbox for a reset link
4. Follow the link to set a new password

---

## Creating Images

The main chat interface is where you generate AI images using natural language prompts.

### Basic Generation

1. Type a description of the image you want in the text box
2. Press **Enter** or click the send button (↑)
3. Wait for the AI to generate your image

**Example prompts:**
- "A serene Japanese garden at sunset with cherry blossoms"
- "A futuristic cityscape with flying cars and neon lights"
- "A cozy coffee shop interior with warm lighting"

### Using Voice Input

If your browser supports speech recognition:

1. Click the **microphone icon** (🎤)
2. Speak your prompt clearly
3. The text will appear in the input box
4. Click send when ready

*Supports English and Chinese.*

### Image Size Options

Choose your preferred image dimensions before generating:

| Size | Dimensions | Best For |
|------|------------|----------|
| **Square** | 1024×1024 | Social media posts, profile pictures |
| **Landscape** | 1792×1024 | Desktop wallpapers, banners |
| **Portrait** | 1024×1792 | Phone wallpapers, vertical displays |

### Style Presets

Enhance your images with artistic styles:

- **None** - Pure DALL-E interpretation
- **Photorealistic** - Realistic photo-like quality
- **Anime/Manga** - Japanese animation style
- **Watercolor** - Soft, painterly look
- **Oil Painting** - Classic fine art style
- **Pixel Art** - Retro 8-bit aesthetic
- **3D Render** - CGI-quality graphics
- **Pencil Sketch** - Hand-drawn appearance
- **Pop Art** - Bold, colorful Andy Warhol style
- **Minimalist** - Clean, simple design
- **Cinematic** - Movie-like dramatic lighting

### Suggestions

When you first open the chat, you'll see suggested prompts. Click any suggestion to use it, or click the refresh button (🔄) to get new ideas.

---

## Image Editing

You can edit existing images by uploading them and drawing on the areas you want to modify.

### How to Edit an Image

1. Click the **image attachment icon** (📎) in the input area
2. Select an image file from your device
3. The image preview will appear
4. Click the **pencil icon** (✏️) to open the mask drawer
5. Draw over the areas you want the AI to modify (shown in red)
6. Click **Done** when finished
7. Type a prompt describing what you want in the marked areas
8. Send to generate the edited image

**Example:** Upload a photo of a room, mark the wall, and prompt "paint the wall ocean blue"

---

## Infographics

PromptInk can create visual infographics from text content.

### From a GitHub Markdown URL

1. Paste a raw GitHub `.md` file URL directly into the chat
2. The app will automatically detect it and generate an infographic

**Example:** `https://raw.githubusercontent.com/user/repo/main/README.md`

### From Text Content

1. Type "infographic about" followed by your topic
2. Or type "create infographic" + your content

**Examples:**
- "infographic about machine learning basics"
- "create infographic: 5 tips for better sleep"

---

## Gallery

The Gallery page stores all your generated images for easy access.

### Accessing the Gallery

- Desktop: Click the **image icon** in the header
- Mobile: Tap the **menu icon** (☰) → Gallery

### Gallery Features

- **View all images** - Browse your generation history
- **Search** - Find images by prompt text
- **Filter** - Show all, favorites only, or by date
- **Favorite** - Heart an image to save it to favorites
- **Delete** - Remove unwanted images
- **Upload** - Add external images to your gallery
- **Full view** - Click any image to see it in detail

### Image Detail Modal

When viewing an image in detail, you can:
- See the original prompt
- Download the image
- Share the image (get a public link)
- Sync to TRMNL
- Navigate between images with arrows

---

## Scheduled Generation

Automatically generate images on a schedule.

### Accessing Schedule

- Desktop: Click the **calendar icon** in the header
- Mobile: Tap the **menu icon** (☰) → Schedule

### Creating a Scheduled Job

1. Click **New Schedule**
2. Enter your prompt
3. Choose image size and style
4. Select schedule type:
   - **Once** - Generate at a specific date/time
   - **Daily** - Generate every day at a set time
   - **Weekly** - Generate on selected days at a set time
5. Set the time for generation
6. (Optional) Enable **Auto Sync to TRMNL**
7. Click **Create**

### Managing Schedules

- **Enable/Disable** - Toggle schedules on or off
- **Edit** - Modify prompt, time, or settings
- **Delete** - Remove a schedule

*Note: Scheduled images are automatically saved to your gallery.*

---

## Batch Generation

Generate multiple images at once with different prompts.

### Accessing Batch

- Desktop: Click the **layers icon** in the header
- Mobile: Tap the **menu icon** (☰) → Batch

### Creating a Batch Job

1. Click **New Batch**
2. Enter a batch name (optional)
3. Add prompts (up to 10):
   - Type each prompt in a separate text area
   - Click **Add** to add more prompts
   - Click **×** to remove a prompt
4. Choose image size and style (applies to all)
5. (Optional) Enable **Auto Sync to TRMNL**
6. Click **Create**

### Batch Status

- **Pending** - Waiting to start
- **Processing** - Currently generating images
- **Completed** - All images generated
- **Failed** - Some or all images failed

### Viewing Batch Results

Click on a completed batch to see all generated images. Each image shows:
- The individual prompt
- Generation status
- The resulting image

---

## TRMNL Sync

Push your images to a TRMNL e-ink display device.

### What is TRMNL?

TRMNL is an e-ink display device that shows custom content. PromptInk integrates with TRMNL to display your AI-generated images.

### Syncing an Image

After generating an image:
1. Click the **Sync to TRMNL** button on the image
2. Wait for confirmation
3. Your TRMNL device will update on its next refresh

### Auto Sync

Enable auto-sync in scheduled or batch jobs to automatically push images to TRMNL when they're generated.

### Requirements

You'll need a TRMNL Custom Plugin UUID configured in Settings. See the [Settings](#settings) section.

---

## Settings

Configure your account and TRMNL integration.

### Accessing Settings

- Desktop: Click the **gear icon** in the header
- Mobile: Tap the **menu icon** (☰) → Settings

### TRMNL Configuration

| Setting | Description |
|---------|-------------|
| **Device API Key** | Your TRMNL device access token (optional, for advanced features) |
| **MAC Address** | Your TRMNL device MAC address (optional, for advanced features) |
| **Background Color** | Choose black or white background for TRMNL display |

*Note: The Device API Key and MAC Address are optional. The main sync functionality uses the Custom Plugin UUID which is configured server-side.*

### Webhook URL

Your personal webhook URL is displayed in Settings. This URL can be used for external integrations.

### Change Password

1. Enter your current password
2. Enter a new password (minimum 8 characters)
3. Confirm the new password
4. Click **Change Password**

---

## Orders & Subscription

### Purchase Page

If you're a new user, you'll be directed to purchase a TRMNL display frame:
- Select quantity
- Choose if it's a gift
- Enter shipping details
- Complete payment via Razorpay

### My Orders

View your order history:
- Desktop: Click the **shopping bag icon**
- Mobile: Tap the **menu icon** (☰) → Orders

Order statuses:
- **Pending** - Awaiting payment
- **Paid** - Payment received
- **Processing** - Order being prepared
- **Shipped** - On the way
- **Delivered** - Arrived

### Subscription

Manage your monthly subscription:
- Desktop: Click the **credit card icon**
- Mobile: Tap the **menu icon** (☰) → Subscription

Subscription features:
- View current status
- See next billing date
- Cancel or reactivate subscription
- Update payment method

---

## Tips & Tricks

### Better Prompts

1. **Be specific** - "A golden retriever playing in autumn leaves in Central Park" beats "dog in park"
2. **Describe the mood** - Add words like "serene," "dramatic," "cozy," or "mysterious"
3. **Specify lighting** - "golden hour lighting," "soft natural light," "neon glow"
4. **Include composition** - "close-up," "wide angle," "bird's eye view"
5. **Reference art styles** - "in the style of Studio Ghibli," "art deco inspired"

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Send message | Enter |
| New line | Shift + Enter |

### Theme & Language

- **Theme** - Toggle between light, dark, and system theme using the sun/moon icon
- **Language** - Switch between English (EN) and Chinese (中) using the language toggle

### Browser Compatibility

For the best experience:
- Use Chrome, Edge, or Safari
- Voice input requires Chrome or Edge
- Enable JavaScript and cookies

---

## Troubleshooting

### Image generation fails

- Check your internet connection
- Try a different prompt (some content may be restricted)
- Wait a moment and try again

### Voice input not working

- Ensure your browser supports Web Speech API (Chrome/Edge recommended)
- Grant microphone permissions when prompted
- Check that your microphone is working

### TRMNL not updating

- Verify your TRMNL Custom Plugin UUID is configured correctly
- Check that your TRMNL device is connected and online
- Wait for the next device refresh cycle

### Session expired

If you're logged out unexpectedly:
- Your session has expired for security
- Simply log in again
- Consider using "Remember me" if available

---

## Getting Help

- **YouTube:** [@promptinkAI](https://www.youtube.com/@promptinkAI-h4o)
- **GitHub:** [PromptInk Repository](https://github.com/kenken64/Promptink)

---

*Happy creating with PromptInk! 🎨✨*
