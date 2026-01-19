import { useRef, useState, useEffect, useCallback } from "react"
import { MaskEditor, toMask } from "react-mask-editor"
import "react-mask-editor/dist/style.css"
import { RotateCcw, Check, X, Minus, Plus } from "lucide-react"
import { Button } from "./ui/button"

interface MaskDrawerProps {
  imageUrl: string
  onComplete: (maskBlob: Blob) => void
  onCancel: () => void
}

export function MaskDrawer({ imageUrl, onComplete, onCancel }: MaskDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cursorSize, setCursorSize] = useState(20)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 512, height: 512 })
  const imageRef = useRef<HTMLImageElement | null>(null)

  // Load image to get dimensions
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      imageRef.current = img
      
      // Calculate dimensions to fit in container while maintaining aspect ratio
      const maxWidth = Math.min(512, window.innerWidth - 48)
      const maxHeight = Math.min(512, window.innerHeight - 200)
      
      let width = img.width
      let height = img.height
      
      if (width > maxWidth) {
        height = (maxWidth / width) * height
        width = maxWidth
      }
      if (height > maxHeight) {
        width = (maxHeight / height) * width
        height = maxHeight
      }
      
      setDimensions({ width, height })
      setImageLoaded(true)
    }
    img.src = imageUrl
  }, [imageUrl])

  const handleReset = useCallback(() => {
    // Get the mask canvas and clear it to white (unmasked)
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [])

  const handleComplete = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    // Get the mask from the canvas using the library's toMask utility
    // This returns a data URL of the black/white mask
    const maskDataUrl = toMask(canvas)

    // Create a canvas at original image size for the final mask
    // DALL-E 2 mask: transparent (alpha=0) = areas to EDIT
    //                opaque (any color, alpha=255) = areas to KEEP
    const maskCanvas = document.createElement("canvas")
    maskCanvas.width = img.width
    maskCanvas.height = img.height
    const maskCtx = maskCanvas.getContext("2d")
    if (!maskCtx) return

    // Load the mask data URL and process it
    const maskImg = new Image()
    maskImg.onload = () => {
      // Draw the mask scaled to original image size
      maskCtx.drawImage(maskImg, 0, 0, img.width, img.height)
      
      // Get image data and convert:
      // Black pixels (drawn by user) → transparent (areas to edit)
      // White pixels (untouched) → opaque white (areas to keep)
      const imageData = maskCtx.getImageData(0, 0, img.width, img.height)
      
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i]
        const g = imageData.data[i + 1]
        const b = imageData.data[i + 2]
        
        // If pixel is dark (black/near-black from mask), make it transparent
        // react-mask-editor outputs black for masked areas, white for unmasked
        if (r < 128 && g < 128 && b < 128) {
          // This is a masked area (user drew here) - make transparent for DALL-E
          imageData.data[i] = 0
          imageData.data[i + 1] = 0
          imageData.data[i + 2] = 0
          imageData.data[i + 3] = 0 // Transparent = edit this area
        } else {
          // This is an unmasked area - keep opaque white for DALL-E
          imageData.data[i] = 255
          imageData.data[i + 1] = 255
          imageData.data[i + 2] = 255
          imageData.data[i + 3] = 255 // Opaque = keep this area
        }
      }
      
      maskCtx.putImageData(imageData, 0, 0)

      // Convert to PNG blob
      maskCanvas.toBlob((blob) => {
        if (blob) {
          onComplete(blob)
        }
      }, "image/png")
    }
    maskImg.src = maskDataUrl
  }, [onComplete])

  const adjustBrushSize = (delta: number) => {
    setCursorSize(prev => Math.max(5, Math.min(100, prev + delta)))
  }

  if (!imageLoaded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="text-muted-foreground">Loading image...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      {/* Header */}
      <div className="mb-4 text-center">
        <h3 className="text-lg font-semibold">Mark areas to edit</h3>
        <p className="text-sm text-muted-foreground">
          Draw over the parts you want to modify (hold Shift or right-click to erase)
        </p>
      </div>

      {/* Mask Editor container */}
      <div 
        className="relative rounded-lg overflow-hidden border shadow-lg"
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        <MaskEditor
          src={imageUrl}
          canvasRef={canvasRef as React.MutableRefObject<HTMLCanvasElement>}
          cursorSize={cursorSize}
          onCursorSizeChange={setCursorSize}
          maskOpacity={0.6}
          maskColor="#ff0000"
          maskBlendMode="normal"
        />
      </div>

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {/* Brush size */}
        <div className="flex items-center gap-1 rounded-lg border bg-secondary/50 p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => adjustBrushSize(-5)}
            className="h-8 w-8"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-16 text-center text-sm">Brush: {cursorSize}px</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => adjustBrushSize(5)}
            className="h-8 w-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Reset */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="h-8"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset
        </Button>

        {/* Instructions */}
        <div className="text-xs text-muted-foreground px-2">
          Scroll to resize brush
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="px-6"
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleComplete}
          className="px-6"
        >
          <Check className="h-4 w-4 mr-1" />
          Done
        </Button>
      </div>
    </div>
  )
}
