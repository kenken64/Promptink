import { useRef, useState, useEffect, useCallback } from "react"
import { Stage, Layer, Image as KonvaImage, Line } from "react-konva"
import Konva from "konva"
import { RotateCcw, Check, X, Minus, Plus, Paintbrush } from "lucide-react"
import { Button } from "./ui/button"

interface MaskDrawerProps {
  imageUrl: string
  onComplete: (maskBlob: Blob, previewDataUrl: string) => void
  onCancel: () => void
}

interface LineData {
  tool: "brush" | "eraser"
  points: number[]
  strokeWidth: number
}

export function MaskDrawer({ imageUrl, onComplete, onCancel }: MaskDrawerProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const drawLayerRef = useRef<Konva.Layer>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(30)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [lines, setLines] = useState<LineData[]>([])
  const [currentLine, setCurrentLine] = useState<LineData | null>(null)

  // Load the image
  useEffect(() => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
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
      setImage(img)
      setImageLoaded(true)
    }
    img.onerror = () => {
      console.error("Failed to load image:", imageUrl)
    }
    img.src = imageUrl
  }, [imageUrl])

  const getPointerPosition = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const pos = stage.getPointerPosition()
    return pos || { x: 0, y: 0 }
  }, [])

  const handleMouseDown = useCallback(() => {
    setIsDrawing(true)
    const pos = getPointerPosition()
    const newLine: LineData = {
      tool: "brush",
      points: [pos.x, pos.y],
      strokeWidth: brushSize,
    }
    setCurrentLine(newLine)
  }, [brushSize, getPointerPosition])

  const handleMouseMove = useCallback(() => {
    if (!isDrawing || !currentLine) return
    
    const pos = getPointerPosition()
    const newPoints = [...currentLine.points, pos.x, pos.y]
    setCurrentLine({ ...currentLine, points: newPoints })
  }, [isDrawing, currentLine, getPointerPosition])

  const handleMouseUp = useCallback(() => {
    if (currentLine) {
      setLines([...lines, currentLine])
      setCurrentLine(null)
    }
    setIsDrawing(false)
  }, [currentLine, lines])

  const handleReset = () => {
    setLines([])
    setCurrentLine(null)
  }

  const handleComplete = useCallback(() => {
    const stage = stageRef.current
    const drawLayer = drawLayerRef.current
    if (!stage || !drawLayer || !image) return

    // Create mask at original image size
    const maskCanvas = document.createElement("canvas")
    maskCanvas.width = image.width
    maskCanvas.height = image.height
    const maskCtx = maskCanvas.getContext("2d")
    if (!maskCtx) return

    // Fill with white (areas to keep)
    maskCtx.fillStyle = "rgba(255, 255, 255, 1)"
    maskCtx.fillRect(0, 0, image.width, image.height)

    // Scale factor from display to original
    const scaleX = image.width / dimensions.width
    const scaleY = image.height / dimensions.height

    // Draw the mask: transparent where user drew
    // We need to track which areas were drawn (not erased)
    const drawnCanvas = document.createElement("canvas")
    drawnCanvas.width = image.width
    drawnCanvas.height = image.height
    const drawnCtx = drawnCanvas.getContext("2d")
    if (!drawnCtx) return

    // Replay all lines to build the drawn area
    for (const line of lines) {
      drawnCtx.strokeStyle = "rgba(255, 0, 0, 1)"
      drawnCtx.lineWidth = line.strokeWidth * scaleX
      drawnCtx.lineCap = "round"
      drawnCtx.lineJoin = "round"
      
      drawnCtx.beginPath()
      const points = line.points
      if (points.length >= 2) {
        drawnCtx.moveTo(points[0] * scaleX, points[1] * scaleY)
        for (let i = 2; i < points.length; i += 2) {
          drawnCtx.lineTo(points[i] * scaleX, points[i + 1] * scaleY)
        }
        drawnCtx.stroke()
      }
    }

    // Get the drawn area data
    const drawnData = drawnCtx.getImageData(0, 0, image.width, image.height)
    const maskData = maskCtx.getImageData(0, 0, image.width, image.height)

    // Make mask transparent where there's drawing
    for (let i = 0; i < drawnData.data.length; i += 4) {
      if (drawnData.data[i + 3] > 0) {
        maskData.data[i + 3] = 0 // Make transparent
      }
    }
    maskCtx.putImageData(maskData, 0, 0)

    // Create preview image (stage with all layers)
    const previewDataUrl = stage.toDataURL({ pixelRatio: 1 })

    maskCanvas.toBlob((blob) => {
      if (blob) {
        onComplete(blob, previewDataUrl)
      }
    }, "image/png")
  }, [image, dimensions, lines, onComplete])

  const adjustBrushSize = (delta: number) => {
    setBrushSize(prev => Math.max(10, Math.min(100, prev + delta)))
  }

  if (!imageLoaded || !image) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="text-muted-foreground">Loading image...</div>
      </div>
    )
  }

  // Combine lines and current line for rendering
  const allLines = currentLine ? [...lines, currentLine] : lines

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      {/* Header */}
      <div className="mb-4 text-center">
        <h3 className="text-lg font-semibold">Mark areas to edit</h3>
        <p className="text-sm text-muted-foreground">
          Draw over the parts you want to modify
        </p>
      </div>

      {/* Konva Stage */}
      <div 
        className="rounded-lg overflow-hidden border shadow-lg touch-none"
        style={{ 
          width: dimensions.width, 
          height: dimensions.height,
          cursor: "crosshair"
        }}
      >
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
          {/* Background image layer */}
          <Layer>
            <KonvaImage
              image={image}
              width={dimensions.width}
              height={dimensions.height}
            />
          </Layer>
          
          {/* Drawing layer */}
          <Layer ref={drawLayerRef}>
            {allLines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke="rgba(255, 0, 0, 0.5)"
                strokeWidth={line.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {/* Draw indicator */}
        <div className="flex items-center gap-1 rounded-lg border bg-secondary/50 p-1">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-8 px-3"
          >
            <Paintbrush className="h-4 w-4 mr-1" />
            Draw
          </Button>
        </div>

        {/* Brush size */}}
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
