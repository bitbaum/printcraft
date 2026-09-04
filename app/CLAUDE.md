@~/.claude/CLAUDE.md

# PrintCraft — Scene Composer for Physical Art

## What This Is

PrintCraft turns separate photos of real people into one unified artwork — printed on physical surfaces that matter.

This is NOT a collage app. This is NOT a filter app. This is a new medium: **scene composition from life**.

People who were never in the same place, at the same time, brought together in one scene — in any art style, for any surface, with faces you'd recognize across a room.

The output is always physical: a shower wall, a canvas, a tile mural, a metal print. Digital-only has no soul. The artifact is the point.

---

## Ground Truths

These are the irreducible facts this product is built on. Every decision traces back to one of these.

### 1. The face is everything.

If the person isn't recognizable, the artwork is worthless. A beautiful painting of a stranger has no emotional meaning. Face fidelity is the single constraint that cannot be relaxed — not for style, not for speed, not for cost.

**Implication:** Every technical decision serves face preservation. If an AI model can't keep faces, we don't use it. If a style destroys likeness, we constrain the style. The face is sacred.

### 2. The physical object creates the emotion.

A JPEG on a phone is forgotten in seconds. A 2-meter glass print you see every morning while showering — that's a daily moment of joy. The medium amplifies the meaning. A memorial portrait on canvas hits different than the same image in a browser tab.

**Implication:** We design for print from minute one. Dimensions, DPI, bleed, seam positions, viewing distance — these aren't afterthoughts. They're core to the product. We don't export "images" — we export artifacts.

### 3. Separate moments can become one truth.

A photo of Dad from 2019, Mom from 2022, and the kids from last week — these are fragments. Composed together in a scene, they become something that feels more true than any individual photo. The family was never all together at the beach? Now they are, and it feels right.

**Implication:** The composition must be seamless. Style consistency across all figures. Lighting coherence. Scale correctness. If any element feels "pasted in," the illusion breaks and the emotion dies.

### 4. Art style carries emotion.

The same scene as a retro travel poster evokes nostalgia and warmth. As a Renaissance painting, it evokes gravitas and permanence. As a comic book panel, it evokes fun and energy. The style isn't decoration — it's the emotional lens through which the viewer experiences the people.

**Implication:** Style selection is a first-class feature, not a filter. Users need to understand what each style evokes before choosing. We curate styles for emotional impact, not just visual novelty.

### 5. Physical surfaces have physics.

A shower wall has seams where glass panels meet. A canvas wraps at edges. A mural has grout lines between tiles. A poster has a frame that crops. These physical constraints aren't bugs — they're design parameters that affect where faces can go, how the composition flows, and what the viewer actually sees.

**Implication:** Surface specification happens BEFORE composition, not after. The system must know the physical constraints to prevent faces on seam lines, key details in fixture zones, or important elements beyond crop boundaries.

---

## The Problem We Solve

**People can't always be together.** Distance, schedules, death — life separates us. Photography captures who was there. PrintCraft creates who should have been there.

### Use Cases (Ordered by Emotional Depth)

1. **Memorial** — Bring a deceased loved one into a family photo. Grandpa at the grandchild's graduation he never saw. The friend who passed, back with the group. *(Sorrow + love + longing)*

2. **Legacy** — Multi-generational family portraits that span decades. Great-grandparents with great-grandchildren in one scene. *(Continuity + belonging)*

3. **Celebration** — A friend group scattered across continents, together at the place they first met. A retirement gift showing decades of colleagues. *(Joy + nostalgia)*

4. **Passion** — Enthusiast communities united in their element. Amphicar owners cruising Lake Garda together. A car club at Le Mans. Musicians on one stage. *(Pride + identity)*

5. **Surprise** — Birthday gifts, anniversaries, housewarmings. A custom artwork nobody expects, of a moment that never happened but everyone wishes did. *(Delight + thoughtfulness)*

---

## Architecture

### System Overview

```
User uploads photos → Face extraction + preservation → Style transfer (per-figure) → Scene composition → Surface mapping → Print export
```

### Core Pipeline

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  1. INTAKE   │────▸│  2. EXTRACT   │────▸│  3. STYLE   │
│              │     │              │     │             │
│ Upload photos│     │ Detect faces │     │ Convert each│
│ of people    │     │ Segment people│    │ figure to   │
│              │     │ Preserve face │    │ chosen style│
│              │     │ reference     │     │ consistently│
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
┌─────────────┐     ┌──────────────┐     ┌──────▼──────┐
│  6. EXPORT   │◂────│  5. SURFACE   │◂────│  4. COMPOSE │
│              │     │              │     │             │
│ Print-ready  │     │ Map to physical│   │ Place figures│
│ files with   │     │ dimensions,   │    │ into scene  │
│ bleed, DPI,  │     │ seams, fixtures│   │ with bg     │
│ color profile│     │ dead zones    │    │             │
└─────────────┘     └──────────────┘     └─────────────┘
```

### Stage Details

#### 1. Intake
- Upload 1-20 photos of different people
- Each photo = one "figure" (person or group in a vehicle/setting)
- User identifies who is in each photo (for the final composition)
- Photos stored per-project, never shared across projects

#### 2. Extract
- Face detection + embedding extraction (for likeness verification later)
- Person/vehicle segmentation (separate subject from background)
- Pose estimation (to maintain natural positioning)
- **Quality gate:** If face is too small, blurry, or occluded — warn user, suggest better photo

#### 3. Style Transfer
- Convert each extracted figure to the chosen art style
- **Critical constraint:** Face likeness must survive style transfer
- Each figure generated independently but with the SAME style prompt/parameters
- **Verification step:** Compare face embedding of styled output vs original — reject if similarity drops below threshold
- Multiple AI backends (see Technology section)

#### 4. Compose
- Scene background generated or selected (Lake Garda, Parisian café, mountain peak, etc.)
- Figures placed into scene according to user layout
- Lighting harmonization across all elements
- Scale normalization (people at correct relative sizes for their depth position)
- **User control:** Drag-and-drop placement with guidelines showing safe zones

#### 5. Surface Mapping
- User specifies physical output:
  - Surface type (glass, canvas, metal, paper, tile)
  - Dimensions (per panel if multi-panel)
  - Seam/joint positions
  - Fixture/obstruction zones (shower heads, frames, grout lines)
- System validates: no face/key-detail in dead zones
- Preview mockup on 3D model of actual surface

#### 6. Export
- Generate at target DPI (150-300 depending on viewing distance)
- Add bleed margins (2-5mm per edge)
- Split into panels if multi-panel surface
- Color profile (sRGB for most large-format, CMYK option)
- Export formats: PNG, TIFF, PDF
- Include print spec sheet for the print shop

---

## Technology

### Stack
- **Framework:** Next.js 16 (App Router) + TypeScript strict
- **Database:** PostgreSQL (Supabase) — projects, figures, compositions, exports
- **Storage:** Supabase Storage — uploaded photos, generated images, exports
- **Auth:** Supabase Auth (email + magic link, no social login at MVP)
- **UI:** Tailwind CSS + shadcn/ui
- **Canvas:** Konva.js (react-konva) — drag-and-drop composition editor
- **3D Preview:** Three.js — surface mockup visualization
- **Payments:** Stripe (per-project pricing, not subscription)

### AI Backends (Pluggable)

Face likeness quality varies by provider. We abstract behind an interface:

```typescript
interface StyleEngine {
  name: string;
  supportsFaceReference: boolean;
  maxResolution: { width: number; height: number };
  estimatedCostPerImage: number; // USD
  generate(params: {
    sourceImage: Buffer;        // Original photo
    faceEmbedding: Float32Array; // For likeness verification
    stylePrompt: string;
    negativePrompt?: string;
  }): Promise<GenerationResult>;
}
```

| Provider | Face Likeness | Quality | Cost | Status |
|----------|--------------|---------|------|--------|
| Grok (xAI Aurora) | Good | Good | Free tier | Primary for MVP |
| Flux Pro + IP-Adapter | Very good | Excellent | ~$0.05/img | Via Replicate |
| Midjourney --cref | Good | Excellent | $10/mo | Manual for now |
| DALL-E | Poor (EU filters) | Good scenes | $0.04/img | Backgrounds only |
| Stable Diffusion + ControlNet | Full control | Variable | Self-hosted | Future (needs GPU) |

### Face Verification

After every style transfer, we verify likeness:

```typescript
// Using face-api.js or InsightFace
const originalEmbedding = await extractFaceEmbedding(originalPhoto);
const styledEmbedding = await extractFaceEmbedding(styledOutput);
const similarity = cosineSimilarity(originalEmbedding, styledEmbedding);

if (similarity < MINIMUM_LIKENESS_THRESHOLD) {
  // Reject and regenerate, or warn user
}
```

This is non-negotiable. Ground Truth #1: the face is everything.

---

## Data Model

```
projects
  ├── id, user_id, name, status
  ├── scene_description (text)
  ├── style_id (FK → styles)
  └── surface_id (FK → surfaces)

figures
  ├── id, project_id
  ├── original_photo_url
  ├── face_embedding (vector)
  ├── extracted_url (segmented, no background)
  ├── styled_url (in art style)
  ├── label (e.g., "Roli + girlfriend")
  └── position_in_scene (json: x, y, scale, z-depth)

surfaces
  ├── id, project_id
  ├── type (glass | canvas | metal | paper | tile)
  ├── panels (json array: [{width_cm, height_cm}])
  ├── seam_positions (json array: [{x_cm}])
  ├── dead_zones (json array: [{x, y, width, height, reason}])
  └── dpi_target

styles
  ├── id, name, description
  ├── emotional_tone (text: "nostalgic", "joyful", "solemn", etc.)
  ├── example_url
  ├── prompt_template (text with {placeholders})
  └── negative_prompt

compositions
  ├── id, project_id
  ├── background_url
  ├── composite_url (final merged image)
  ├── layout (json: figure positions, scales, depths)
  └── version (integer, increments with each edit)

exports
  ├── id, composition_id
  ├── format (png | tiff | pdf)
  ├── dpi, width_px, height_px
  ├── panels (json: [{panel_index, file_url}])
  ├── bleed_mm
  └── color_profile (srgb | cmyk)
```

---

## UI/UX

### Flow

```
1. NEW PROJECT
   "What are you creating?" → Name + brief description
   ↓
2. UPLOAD PEOPLE
   Drop photos → Each becomes a "figure" card
   Face detected → Thumbnail with name label
   ↓
3. CHOOSE STYLE
   Gallery of styles with emotional descriptions + previews
   E.g., "Retro Travel Poster — warm nostalgia, golden tones, bold lines"
   ↓
4. DEFINE SURFACE
   What will this be printed on?
   → Preset templates (shower wall, canvas, poster) or custom dimensions
   → Mark seams, fixtures, dead zones on a visual editor
   ↓
5. GENERATE
   System converts each figure to chosen style (progress shown per-figure)
   Face verification runs automatically — flagged if likeness drops
   ↓
6. COMPOSE
   Drag figures onto scene canvas
   Background generated based on scene description
   Dead zones shown as overlays — figures snap away from them
   Real-time preview at actual aspect ratio
   ↓
7. PREVIEW
   3D mockup of artwork on the actual surface
   Rotate, zoom, see how it looks in context
   ↓
8. EXPORT
   Choose DPI, format, color profile
   Download print-ready files (split per panel if needed)
   Print spec sheet auto-generated
```

### Design Principles

1. **The artwork is the hero.** UI gets out of the way. Dark, minimal chrome. The canvas dominates.

2. **Progressive disclosure.** Step 1 asks one question. Complexity reveals itself as needed. A first-time user creating a simple canvas print shouldn't see tile grout settings.

3. **Always show the physical output.** Not just pixels — show it on the surface. The shower wall mockup. The living room with the canvas. The medium IS the message.

4. **Emotional guidance over technical options.** Don't ask "what rendering engine?" Ask "what feeling should this evoke?" Map emotions to styles, not parameters.

5. **Face confidence is visible.** After generation, each figure shows a likeness score. Green = perfect match. Yellow = review. Red = regenerate. The user always knows if faces are right.

6. **Dead zones are sacred.** The system physically prevents placing a face on a seam line. This isn't a suggestion — it's a constraint. You can't drag a face into the dead zone. Period.

---

## Style Library (Initial)

| Style | Emotional Tone | Reference |
|-------|---------------|-----------|
| Retro Travel Poster | Warm nostalgia, golden hour, adventure | 1960s tourism ads, Amphicar brochures |
| Oil Portrait | Gravitas, permanence, legacy | Classical portraiture, warm darks |
| Watercolor | Gentle, dreamy, ephemeral | Soft edges, bleeding colors |
| Pop Art | Bold, energetic, celebration | Warhol/Lichtenstein, flat vivid colors |
| Comic Book (European) | Fun, dynamic, storytelling | Hergé/Tintin, Franco-Belgian BD |
| Comic Book (American) | Heroic, dramatic, powerful | Marvel/DC splash pages |
| Japanese Woodblock | Serene, meditative, timeless | Hokusai, ukiyo-e, flat perspective |
| Art Deco | Elegant, glamorous, sophisticated | 1920s poster art, geometric |
| Renaissance | Sacred, eternal, reverence | Florentine painting, chiaroscuro |
| Impressionist | Warmth, movement, life | Monet/Renoir, visible brushstrokes |
| Pixel Art | Playful, retro-digital, charming | 16-bit era, limited palette |
| Noir | Moody, mysterious, dramatic | Film noir, high contrast B&W |

Each style includes:
- A prompt template calibrated for that style
- A negative prompt (what to avoid)
- Example output for preview
- Emotional description (not technical jargon)

---

## Pricing Model

Per-project, not subscription. This is an event purchase (like ordering prints), not a daily tool.

| Tier | Figures | Surface | Price | Includes |
|------|---------|---------|-------|----------|
| **Simple** | 1-3 | Single panel | CHF 29 | 1 style, 3 regenerations |
| **Group** | 4-8 | Multi-panel | CHF 59 | 1 style, 5 regenerations |
| **Epic** | 9-20 | Any surface | CHF 99 | 2 styles to compare, 10 regenerations |

Regeneration = re-generating a figure if face isn't right. Included in tier, not nickel-and-dimed.

**Print fulfillment** is separate — partner with print shops, take referral margin. Don't own the printing. Focus on the art.

---

## What NOT to Build

- **Social features.** No sharing, no likes, no community gallery. This is personal art. The audience is the person who made it and the people in it.
- **Templates with stock people.** Every figure must be from a real photo of a real person. This is not Canva.
- **Mobile app.** The composition editor needs a real screen. Web-only, responsive down to tablet. Phone is for viewing the 3D preview, not composing.
- **Real-time generation.** Quality takes time. Set expectations: "Your artwork is being created" with progress, not instant filters.
- **AI chat/assistant.** The UI should be self-explanatory. If you need a chatbot to explain your product, your UX has failed.

---

## Development Phases

### Phase 1: Manual-Assisted MVP
- Upload photos
- Define surface with dimensions + dead zones
- Generate style-transferred figures via Grok API (or manual upload from Grok web)
- Simple canvas editor for composition
- Export at target DPI + panel split
- **Goal:** Replace the manual workflow we've been doing for Roli's Duschwand

### Phase 2: Automated Pipeline
- Automated face extraction + embedding
- Automated style transfer with face verification
- Background scene generation
- Likeness scoring with auto-reject below threshold
- **Goal:** User uploads photos → gets artwork without manual AI prompting

### Phase 3: Physical Preview
- 3D surface mockup (shower wall, canvas on wall, etc.)
- Preset surface templates (common print sizes, IKEA frames, etc.)
- Print shop integration (order fulfillment)
- **Goal:** See it on your wall before you print it

### Phase 4: Scale
- Style marketplace (artists submit custom styles)
- Batch processing (photo books, series)
- API for integrations (print shop widgets, gift card services)
- **Goal:** Other people can use this without us

---

## File Structure

```
app/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Login, register
│   │   ├── (dashboard)/        # Project list, new project
│   │   ├── project/[id]/       # Project workspace
│   │   │   ├── upload/         # Step 2: Upload photos
│   │   │   ├── style/          # Step 3: Choose style
│   │   │   ├── surface/        # Step 4: Define surface
│   │   │   ├── generate/       # Step 5: Generate figures
│   │   │   ├── compose/        # Step 6: Composition editor
│   │   │   ├── preview/        # Step 7: 3D preview
│   │   │   └── export/         # Step 8: Export
│   │   └── api/                # API routes
│   ├── lib/
│   │   ├── config/             # Style definitions, surface presets, pricing
│   │   ├── domain/             # Business logic (no HTTP, no UI)
│   │   │   ├── face.ts         # Face detection, embedding, verification
│   │   │   ├── style.ts        # Style transfer orchestration
│   │   │   ├── compose.ts      # Scene composition logic
│   │   │   ├── surface.ts      # Surface constraints, dead zones
│   │   │   └── export.ts       # Print-ready file generation
│   │   └── ai/                 # AI provider abstraction
│   │       ├── interface.ts    # StyleEngine interface
│   │       ├── grok.ts         # xAI/Grok implementation
│   │       ├── replicate.ts    # Flux Pro via Replicate
│   │       └── dalle.ts        # DALL-E (backgrounds only)
│   ├── components/
│   │   ├── canvas/             # Composition editor components
│   │   ├── surface/            # Surface definition UI
│   │   ├── preview/            # 3D mockup viewer
│   │   └── ui/                 # shadcn/ui base components
│   └── hooks/                  # React hooks for data fetching, state
├── supabase/
│   └── migrations/             # Database schema
├── public/
│   └── styles/                 # Style preview images
└── package.json
```

---

## Red Flags — Stop If You See These

1. **Face looks "off" but you ship anyway** → Ground Truth #1 violated. Regenerate or warn user.
2. **Building features nobody asked for** → Solve Roli's Duschwand first. That's the real test.
3. **Optimizing AI cost before validating quality** → Cheap generations with bad faces = worthless product.
4. **Making the UI pretty before the pipeline works** → A beautiful app that produces bad art is worse than an ugly app that produces great art.
5. **Adding social features** → This is personal. Keep it personal.
6. **Skipping surface constraints** → A face split by a glass seam ruins the entire artwork. This is not optional.
7. **Designing for mobile composition** → You can't do precise drag-and-drop placement on a phone. Accept this.

---

## Success Metric

One metric: **Would the person who receives this artwork hang it on their wall and smile every time they see it?**

If yes, we succeeded. If no, nothing else matters.
