// Generate PWA icons from SVG using sharp
import sharp from "sharp"
import { mkdirSync, existsSync } from "fs"
import { join } from "path"

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const iconsDir = join(import.meta.dir, "public/icons")
const svgPath = join(import.meta.dir, "public/favicon.svg")

// Ensure icons directory exists
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true })
}

// Read SVG file
const svgBuffer = await Bun.file(svgPath).arrayBuffer()

console.log("Generating PWA icons...")

for (const size of sizes) {
  const outputPath = join(iconsDir, `icon-${size}.png`)
  
  await sharp(Buffer.from(svgBuffer))
    .resize(size, size)
    .png()
    .toFile(outputPath)
  
  console.log(`  ✓ Generated icon-${size}.png`)
}

console.log("\nAll icons generated successfully!")
