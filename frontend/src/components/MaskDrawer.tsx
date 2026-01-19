import { useRef, useEffect, useState, useCallback } from "react"
import { Eraser, Paintbrush, RotateCcw, Check, X, Minus, Plus } from "lucide-react"
import { Button } from "./ui/button"
import { cn } from "../lib/utils"

interface MaskDrawerProps {
  imageUrl: string
  onComplete: (maskBlob: Blob) => void
  onCancel: () => void
}

export function MaskDrawer({ imageUrl, onComplete, onCancel }: MaskDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(30)
  const [tool, setTool] = useState<"brush" | "eraser">("brush")
  const [imageLoaded, setImageLoaded] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const imageRef = useRef<HTMLImageElement | null>(null)
  const cursorRef = useRef<HTMLDivElement>(null)

  // Load and display the image
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

  // Initialize canvases when dimensions are set
  useEffect(() => {
    if (!imageLoaded || dimensions.width === 0) return

    const canvas = canvasRef.current
    const overlay = overlayRef.current
    const img = imageRef.current
    if (!canvas || !overlay || !img) return

    // Set canvas dimensions
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    overlay.width = dimensions.width
    overlay.height = dimensions.height

    // Draw the image on main canvas
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height)
    }

    // Initialize overlay as transparent
    const overlayCtx = overlay.getContext("2d")
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, dimensions.width, dimensions.height)
    }
  }, [imageLoaded, dimensions])

  const getPosition = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = overlayRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ("touches" in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const draw = useCallback((x: number, y: number) => {
    const overlay = overlayRef.current
    if (!overlay) return

    const ctx = overlay.getContext("2d", { willReadFrequently: false })
    if (!ctx) return

    if (tool === "brush") {
      // Draw semi-transparent red to show marked areas
      ctx.globalCompositeOperation = "source-over"
      ctx.beginPath()
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
      ctx.fill()
    } else {
      // Erase using destination-out - must be set BEFORE beginPath
      ctx.globalCompositeOperation = "destination-out"
      ctx.beginPath()
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
      ctx.fillStyle = "white" // Color doesn't matter, only alpha
      ctx.fill()
      ctx.globalCompositeOperation = "source-over"
    }
  }, [brushSize, tool])

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDrawing(true)
    const { x, y } = getPosition(e)
    draw(x, y)

    // Update cursor immediately
    if (cursorRef.current) {
      cursorRef.current.style.display = "block"
      cursorRef.current.style.width = `${brushSize}px`
      cursorRef.current.style.height = `${brushSize}px`
      cursorRef.current.style.transform = `translate(${x - brushSize / 2}px, ${y - brushSize / 2}px)`
    }
  }, [getPosition, draw, brushSize])

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const { x, y } = getPosition(e)

    // Always update cursor position
    if (cursorRef.current) {
      cursorRef.current.style.display = "block"
      cursorRef.current.style.width = `${brushSize}px`
      cursorRef.current.style.height = `${brushSize}px`
      cursorRef.current.style.transform = `translate(${x - brushSize / 2}px, ${y - brushSize / 2}px)`
    }

    if (isDrawing) {
      draw(x, y)
    }
  }, [isDrawing, getPosition, draw, brushSize])

  const handleUp = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const handleLeave = useCallback(() => {
    setIsDrawing(false)
    if (cursorRef.current) {
      cursorRef.current.style.display = "none"
    }
  }, [])

  const handleReset = () => {
    const overlay = overlayRef.current
    if (!overlay) return

    const ctx = overlay.getContext("2d")
    if (ctx) {
      ctx.clearRect(0, 0, overlay.width, overlay.height)
    }
  }

  const handleComplete = () => {
    const overlay = overlayRef.current
    const img = imageRef.current
    if (!overlay || !img) return

    // Create a mask canvas at original image size
    // DALL-E 2 mask: transparent (alpha=0) = areas to EDIT
    //                opaque (any color, alpha=255) = areas to KEEP
    const maskCanvas = document.createElement("canvas")
    maskCanvas.width = img.width
    maskCanvas.height = img.height
    const maskCtx = maskCanvas.getContext("2d")
    if (!maskCtx) return

    const scaleX = img.width / overlay.width
    const scaleY = img.height / overlay.height

    // Fill the entire mask with opaque white (areas to keep)
    maskCtx.fillStyle = "rgba(255, 255, 255, 1)"
    maskCtx.fillRect(0, 0, img.width, img.height)

    // Get the overlay image data to find where user drew
    const overlayCtx = overlay.getContext("2d")
    if (!overlayCtx) return

    // Scale and draw the overlay to a temp canvas at original image size
    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = img.width
    tempCanvas.height = img.height
    const tempCtx = tempCanvas.getContext("2d")
    if (!tempCtx) return
    
    // Draw overlay scaled up to original image size
    tempCtx.drawImage(overlay, 0, 0, overlay.width, overlay.height, 0, 0, img.width, img.height)
    
    // Get the scaled overlay image data
    const tempData = tempCtx.getImageData(0, 0, img.width, img.height)
    const maskData = maskCtx.getImageData(0, 0, img.width, img.height)
    
    // Make pixels transparent where user drew (where overlay has alpha > 0)
    for (let i = 0; i < tempData.data.length; i += 4) {
      // Check if this pixel in the overlay has any color (alpha > 0)
      if (tempData.data[i + 3] > 0) {
        // Set this pixel in mask to fully transparent (area to edit)
        maskData.data[i + 3] = 0
      }
    }
    
    maskCtx.putImageData(maskData, 0, 0)

    // Convert to PNG blob
    maskCanvas.toBlob((blob) => {
      if (blob) {
        onComplete(blob)
      }
    }, "image/png")
  }

  const adjustBrushSize = (delta: number) => {
    setBrushSize(prev => Math.max(10, Math.min(100, prev + delta)))
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
          Draw over the parts you want to modify
        </p>
      </div>

      {/* Canvas container */}
      <div 
        ref={containerRef}
        className="relative rounded-lg overflow-hidden border shadow-lg touch-none"
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        {/* Base image canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
        />
        {/* Drawing overlay canvas */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 cursor-none"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleUp}
          onMouseLeave={handleLeave}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleUp}
        />
        {/* Custom cursor */}
        <div
          ref={cursorRef}
          className="pointer-events-none absolute left-0 top-0 rounded-full border-2 border-white bg-black/10 shadow-[0_0_2px_rgba(0,0,0,1)]"
          style={{ 
            display: "none",
            zIndex: 50
          }}
        />
      </div>

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {/* Tool selection */}
        <div className="flex items-center gap-1 rounded-lg border bg-secondary/50 p-1">
          <Button
            type="button"
            variant={tool === "brush" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTool("brush")}
            className="h-8 px-3"
          >
            <Paintbrush className="h-4 w-4 mr-1" />
            Draw
          </Button>
          <Button
            type="button"
            variant={tool === "eraser" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTool("eraser")}
            className="h-8 px-3"
          >
            <Eraser className="h-4 w-4 mr-1" />
            Erase
          </Button>
        </div>

        {/* Brush size */}
        <div className="flex items-center gap-1 rounded-lg border bg-secondary/50 p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => adjustBrushSize(-10)}
            className="h-8 w-8"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-sm">{brushSize}px</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => adjustBrushSize(10)}
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
