/**
 * Seed Roli's Duschwand project with existing images.
 * Run with: npx tsx scripts/seed-roli-project.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { basename } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://supabase.orangecat.ch';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const BUCKET = 'project-files';
const USER_ID = 'fee8f90d-30b0-4b38-9495-c65acd17eef6';

interface FigureDef {
  label: string;
  originalPath: string;
  styledPath?: string;
  zDepth: number;
}

const FIGURES: FigureDef[] = [
  {
    label: 'Roli + Freundin (B-AP 670)',
    originalPath:
      '/home/g/Dokumente/Duschwand/real-photos/WhatsApp Image 2026-01-03 at 11.33.267.jpeg',
    styledPath: '/home/g/Dokumente/Duschwand/edited/bild1-green-bap670.png',
    zDepth: 5,
  },
  {
    label: 'Gela + Marco (Weiss, Streifen)',
    originalPath:
      '/home/g/Dokumente/Duschwand/real-photos/WhatsApp Image 2026-01-03 at 11.39.5122.jpeg',
    styledPath: '/home/g/Dokumente/Duschwand/edited/bild2-white-stripy.png',
    zDepth: 3,
  },
  {
    label: 'Roma + Andrea (Teal K-D)',
    originalPath:
      '/home/g/Dokumente/Duschwand/real-photos/WhatsApp Image 2026-01-03 at 11.33.267.jpeg',
    styledPath: '/home/g/Dokumente/Duschwand/edited/bild3-teal-kd-black.png',
    zDepth: 2,
  },
  {
    label: 'Andreas + Freundin (AB-N 274, Titanic)',
    originalPath:
      '/home/g/Dokumente/Duschwand/real-photos/WhatsApp Image 2025-12-21 at 12.31.53.jpeg',
    styledPath: '/home/g/Dokumente/Duschwand/edited/bild4-blue-abn274.png',
    zDepth: 4,
  },
  {
    label: 'Marco (Foilboard + Hund)',
    originalPath:
      '/home/g/Dokumente/Duschwand/real-photos/WhatsApp Image 2025-12-31 at 10.44.302.jpeg',
    zDepth: 6,
  },
  {
    label: 'Teus (Blue 66568 JETRANGER)',
    originalPath:
      '/home/g/Dokumente/Duschwand/real-photos/WhatsApp Image 2025-12-31 at 10.14.146.jpeg',
    zDepth: 1,
  },
  {
    label: 'Alberto (Weiss, VW Amphibie)',
    originalPath:
      '/home/g/Dokumente/Duschwand/real-photos/WhatsApp Image 2025-12-10 at 09.21.21 (11).jpeg',
    zDepth: 0,
  },
];

async function uploadFile(localPath: string, storagePath: string): Promise<string> {
  const file = readFileSync(localPath);
  const ext = localPath.split('.').pop()!;
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType, upsert: true });

  if (error) throw new Error(`Upload failed for ${storagePath}: ${error.message}`);
  console.log(`  ✓ Uploaded: ${storagePath}`);
  return data.path;
}

async function main() {
  console.log('Creating Roli Duschwand project...\n');

  // 1. Get the retro-travel style
  const { data: style } = await supabase
    .from('styles')
    .select('id')
    .eq('slug', 'retro-travel')
    .single();

  if (!style) throw new Error('Retro travel style not found');

  // 2. Create project
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .insert({
      user_id: USER_ID,
      name: 'Duschwand Roli',
      description: 'Amphicar poster for shower wall on River Queen houseboat',
      style_id: style.id,
      scene_description:
        'Lake Garda at golden hour — warm sunset sky, green cypress hills, Italian villages with terracotta roofs, mountains in the distance, calm water with golden reflections.',
      status: 'composing',
    })
    .select()
    .single();

  if (projErr) throw new Error(`Project creation failed: ${projErr.message}`);
  console.log(`✓ Project created: ${project.id}\n`);

  // 3. Create surface (Roli's exact Duschwand dimensions)
  const { error: surfErr } = await supabase.from('surfaces').insert({
    project_id: project.id,
    type: 'glass',
    panels: [
      { width_cm: 77.5, height_cm: 190 },
      { width_cm: 119.5, height_cm: 190 },
    ],
    seam_positions: [{ x_cm: 77.5 }],
    dead_zones: [{ x_cm: 18.75, y_cm: 0, width_cm: 40, height_cm: 45, reason: 'Dusch Armatur' }],
    dpi_target: 200,
    bleed_mm: 3,
  });

  if (surfErr) throw new Error(`Surface creation failed: ${surfErr.message}`);
  console.log('✓ Surface created (77.5 + 119.5 cm, with Armatur dead zone)\n');

  // 4. Upload images and create figures
  for (const fig of FIGURES) {
    console.log(`Processing: ${fig.label}`);

    // Upload original
    const origFilename = `original-${basename(fig.originalPath).replace(/\s+/g, '_')}`;
    const origStoragePath = `${USER_ID}/${project.id}/originals/${origFilename}`;
    const origPath = await uploadFile(fig.originalPath, origStoragePath);

    // Upload styled (if exists)
    let styledPath: string | null = null;
    if (fig.styledPath) {
      const styledFilename = basename(fig.styledPath);
      const styledStoragePath = `${USER_ID}/${project.id}/styled/${styledFilename}`;
      styledPath = await uploadFile(fig.styledPath, styledStoragePath);
    }

    // Create figure record
    const { error: figErr } = await supabase.from('figures').insert({
      project_id: project.id,
      label: fig.label,
      original_photo_url: origPath,
      styled_url: styledPath,
      status: styledPath ? 'styled' : 'uploaded',
      z_depth: fig.zDepth,
      position_x: 0.5,
      position_y: 0.5,
      scale: 1.0,
    });

    if (figErr) throw new Error(`Figure creation failed: ${figErr.message}`);
    console.log(
      `  ✓ Figure created: ${fig.label} ${styledPath ? '(with styled)' : '(original only)'}\n`,
    );
  }

  console.log('=== DONE ===');
  console.log(`Project URL: https://printcraft.orangecat.ch/project/${project.id}/figures`);
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
