export interface Style {
  id: string
  name: string
  slug: string
  description: string
  emotional_tone: string
  prompt_template: string
  negative_prompt: string | null
  example_url: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  style_id: string | null
  scene_description: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
  // Joined
  style?: Style | null
  surface?: Surface | null
  figures?: Figure[]
  // Existence probes for progress — ids only, see GET /api/projects.
  surfaces?: { id: string }[]
  compositions?: { id: string }[]
}

export type ProjectStatus =
  | 'draft'
  | 'uploading'
  | 'generating'
  | 'composing'
  | 'previewing'
  | 'exported'
  | 'printed'

export interface Panel {
  width_cm: number
  height_cm: number
}

export interface SeamPosition {
  x_cm: number
}

export interface DeadZone {
  x_cm: number
  y_cm: number
  width_cm: number
  height_cm: number
  reason: string
}

export interface Surface {
  id: string
  project_id: string
  type: SurfaceType
  panels: Panel[]
  seam_positions: SeamPosition[]
  dead_zones: DeadZone[]
  dpi_target: number
  bleed_mm: number
  created_at: string
}

export type SurfaceType = 'glass' | 'canvas' | 'metal' | 'paper' | 'tile' | 'custom'

export interface Figure {
  id: string
  project_id: string
  label: string | null
  original_photo_url: string
  extracted_url: string | null
  styled_url: string | null
  face_embedding: number[] | null
  face_confidence: number | null
  position_x: number | null
  position_y: number | null
  scale: number
  z_depth: number
  status: FigureStatus
  created_at: string
}

export type FigureStatus =
  | 'uploaded'
  | 'extracting'
  | 'extracted'
  | 'styling'
  | 'styled'
  | 'verified'
  | 'failed'

export interface Composition {
  id: string
  project_id: string
  version: number
  background_url: string | null
  composite_url: string | null
  layout: Record<string, unknown> | null
  created_at: string
}

export interface Export {
  id: string
  composition_id: string
  format: 'png' | 'tiff' | 'pdf'
  dpi: number
  width_px: number
  height_px: number
  panels: { panel_index: number; file_url: string }[]
  color_profile: 'srgb' | 'cmyk' | 'adobe_rgb'
  bleed_mm: number
  file_url: string | null
  created_at: string
}
