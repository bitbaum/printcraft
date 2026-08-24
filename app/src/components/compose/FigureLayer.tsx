'use client'

import { useRef, useEffect, useState } from 'react'
import { Image as KonvaImage, Transformer } from 'react-konva'
import { canvasRectToSurfaceCm, checkPlacement } from '@/lib/domain/surface'
import type { PlacementViolation } from '@/lib/domain/surface'
import type Konva from 'konva'
import type { DeadZone, Figure, SeamPosition } from '@/types/database'

interface FigureLayerProps {
  figure: Figure
  imageUrl: string
  canvasWidth: number
  canvasHeight: number
  totalWidthCm: number
  totalHeightCm: number
  deadZones: DeadZone[]
  seams: SeamPosition[]
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (figureId: string, x: number, y: number) => void
  onScaleChange: (figureId: string, scale: number) => void
  /** Fired when a move or resize was refused, so the editor can say why. */
  onBlocked: (violation: PlacementViolation) => void
}

export function FigureLayer({
  figure,
  imageUrl,
  canvasWidth,
  canvasHeight,
  totalWidthCm,
  totalHeightCm,
  deadZones,
  seams,
  isSelected,
  onSelect,
  onDragEnd,
  onScaleChange,
  onBlocked,
}: FigureLayerProps) {
  const imageRef = useRef<Konva.Image>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const lastLegalPos = useRef<{ x: number; y: number } | null>(null)
  const blockedBy = useRef<PlacementViolation | null>(null)
  // A figure can already be sitting in a zone — the surface may have been
  // edited after it was placed. Refusing to move it then would strand it.
  const escapingZone = useRef(false)

  useEffect(() => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.src = imageUrl
  }, [imageUrl])

  useEffect(() => {
    if (isSelected && trRef.current && imageRef.current) {
      trRef.current.nodes([imageRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  if (!image) return null

  // Position: normalized (0-1) -> canvas pixels
  const x = (figure.position_x ?? 0.5) * canvasWidth
  const y = (figure.position_y ?? 0.5) * canvasHeight

  // Scale figure to reasonable size relative to canvas
  const baseScale = Math.min(canvasWidth / image.width, canvasHeight / image.height) * 0.3
  const figScale = baseScale * figure.scale

  /** What this figure would be standing on, given a centre point and a scale. */
  function violationAt(centerXPx: number, centerYPx: number, scale: number): PlacementViolation | null {
    if (!image) return null
    return checkPlacement({
      rect: canvasRectToSurfaceCm({
        centerXPx,
        centerYPx,
        widthPx: image.width * scale,
        heightPx: image.height * scale,
        canvasWidth,
        canvasHeight,
        totalWidthCm,
        totalHeightCm,
      }),
      deadZones,
      seams,
    })
  }

  return (
    <>
      <KonvaImage
        ref={imageRef}
        image={image}
        x={x}
        y={y}
        scaleX={figScale}
        scaleY={figScale}
        offsetX={image.width / 2}
        offsetY={image.height / 2}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragStart={() => {
          blockedBy.current = null
          lastLegalPos.current = { x, y }
          escapingZone.current = violationAt(x, y, figScale) !== null
        }}
        onDragMove={(e) => {
          // Remember the furthest legal point of the gesture. The drag itself is
          // never constrained: a figure has to be able to cross a seam to reach
          // the other panel, and every route between panels passes through the
          // buffer band.
          const node = e.target
          if (violationAt(node.x(), node.y(), figScale) === null) {
            lastLegalPos.current = { x: node.x(), y: node.y() }
          }
        }}
        onDragEnd={(e) => {
          const node = e.target
          const violation = violationAt(node.x(), node.y(), figScale)

          // Design principle 6: a figure cannot come to rest on a fixture or a
          // glass seam. It lands as close to the target as the surface allows
          // instead. A figure that was already stranded in a zone is left alone,
          // so a rescue drag is never undone.
          if (violation && !escapingZone.current) {
            const fallback = lastLegalPos.current ?? { x, y }
            node.position(fallback)
            node.getLayer()?.batchDraw()
            onBlocked(violation)
            onDragEnd(figure.id, fallback.x / canvasWidth, fallback.y / canvasHeight)
            return
          }

          if (violation) onBlocked(violation)
          onDragEnd(figure.id, node.x() / canvasWidth, node.y() / canvasHeight)
        }}
        onTransformEnd={() => {
          const node = imageRef.current
          if (!node) return
          const newScaleX = node.scaleX()

          // Growing a figure can push it into a zone that it fitted beside.
          const violation = violationAt(node.x(), node.y(), newScaleX)
          if (violation && violationAt(node.x(), node.y(), figScale) === null) {
            node.scaleX(figScale)
            node.scaleY(figScale)
            node.getLayer()?.batchDraw()
            onBlocked(violation)
            return
          }

          node.scaleX(newScaleX)
          node.scaleY(newScaleX)
          onScaleChange(figure.id, newScaleX / baseScale)
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          keepRatio={true}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox
            return newBox
          }}
        />
      )}
    </>
  )
}
