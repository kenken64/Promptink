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

    const ctx = overlay.getContext("2d")
    if (!ctx) return

    ctx.beginPath()
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
    
    if (tool === "brush") {
      // Draw semi-transparent red to show marked areas
      ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
      ctx.fill()
    } else {
      // Erase by clearing - need to set fillStyle for destination-out to work
      ctx.globalCompositeOperation = "destination-out"
      ctx.fillStyle = "rgba(0, 0, 0, 1)"
      ctx.fill()
      ctx.globalCompositeOperation = "source-over"
    }
  }, [brushSize, tool])

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDrawing(true)
    const { x, y } = getPosition(e)
    draw(x, y)
  }, [getPosition, draw])

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    const { x, y } = getPosition(e)
    draw(x, y)
  }, [isDrawing, getPosition, draw])

  const handleEnd = useCallback(() => {
    setIsDrawing(false)
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
    const maskCanvas = document.createElement("canvas")
    maskCanvas.width = img.width
    maskCanvas.height = img.height
    const maskCtx = maskCanvas.getContext("2d")
    if (!maskCtx) return

    // Start with fully transparent (areas to keep)
    maskCtx.clearRect(0, 0, img.width, img.height)

    // Get the overlay data and scale it to original size
    const overlayCtx = overlay.getContext("2d")
    if (!overlayCtx) return

    const overlayData = overlayCtx.getImageData(0, 0, overlay.width, overlay.height)
    
    // Create scaled mask - areas that were drawn become transparent (alpha=0)
    // Areas that were not drawn become opaque (alpha=255)
    const scaleX = img.width / overlay.width
    const scaleY = img.height / overlay.height

    // Fill the mask with white first (areas to keep)
    maskCtx.fillStyle = "white"
    maskCtx.fillRect(0, 0, img.width, img.height)

    // Now make drawn areas transparent
    maskCtx.globalCompositeOperation = "destination-out"
    
    // Draw scaled version of overlay onto mask
    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = img.width
    tempCanvas.height = img.height
    const tempCtx = tempCanvas.getContext("2d")
    if (tempCtx) {
      tempCtx.scale(scaleX, scaleY)
      tempCtx.drawImage(overlay, 0, 0)
      maskCtx.drawImage(tempCanvas, 0, 0)
    }

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
          className="absolute inset-0 cursor-crosshair"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
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
