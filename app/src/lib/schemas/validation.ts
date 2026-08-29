import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  scene_description: z.string().max(1000).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  style_id: z.string().uuid().nullable().optional(),
  scene_description: z.string().max(1000).nullable().optional(),
  status: z
    .enum(['draft', 'uploading', 'generating', 'composing', 'previewing', 'exported', 'printed'])
    .optional(),
});

export const createFigureSchema = z.object({
  project_id: z.string().uuid(),
  label: z.string().max(100).optional(),
  original_photo_url: z.string().min(1),
});

export const updateFigureSchema = z.object({
  label: z.string().max(100).nullable().optional(),
  styled_url: z.string().nullable().optional(),
  position_x: z.number().min(0).max(1).nullable().optional(),
  position_y: z.number().min(0).max(1).nullable().optional(),
  scale: z.number().min(0.1).max(10).optional(),
  z_depth: z.number().int().optional(),
  status: z
    .enum(['uploaded', 'extracting', 'extracted', 'styling', 'styled', 'verified', 'failed'])
    .optional(),
});

const panelSchema = z.object({
  width_cm: z.number().positive(),
  height_cm: z.number().positive(),
});

const deadZoneSchema = z.object({
  x_cm: z.number().min(0),
  y_cm: z.number().min(0),
  width_cm: z.number().positive(),
  height_cm: z.number().positive(),
  reason: z.string().max(100),
});

export const upsertSurfaceSchema = z.object({
  project_id: z.string().uuid(),
  type: z.enum(['glass', 'canvas', 'metal', 'paper', 'tile', 'custom']),
  panels: z.array(panelSchema).min(1).max(10),
  seam_positions: z.array(z.object({ x_cm: z.number().min(0) })),
  dead_zones: z.array(deadZoneSchema),
  dpi_target: z.number().int().min(72).max(600),
  bleed_mm: z.number().min(0).max(20),
});

export const upsertCompositionSchema = z.object({
  project_id: z.string().uuid(),
  background_url: z.string().nullable().optional(),
  layout: z.record(z.string(), z.unknown()).optional(),
});

export type CreateProject = z.infer<typeof createProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type CreateFigure = z.infer<typeof createFigureSchema>;
export type UpdateFigure = z.infer<typeof updateFigureSchema>;
export type UpsertSurface = z.infer<typeof upsertSurfaceSchema>;
export type UpsertComposition = z.infer<typeof upsertCompositionSchema>;
