# PrintCraft

Custom artwork generation for physical print surfaces — shower walls, canvases,
tile murals. AI-generated illustrations with recognizable faces, composed to
exact print dimensions.

## Quick start

```bash
# Install the CLI (editable install)
pip install -e .

# Inspect a project
printcraft project info projects/duschwand-roli
printcraft project list-scenes projects/duschwand-roli

# Generate a single scene (writes to rounds/YYYY-MM-DD-adhoc/)
printcraft generate scene projects/duschwand-roli hero

# Generate every scene in the project
printcraft generate all-scenes projects/duschwand-roli --round 2026-04-retro
```

## Repository layout

```
printcraft/
├── printcraft/           # Python package — the library
│   ├── project.py        # Loads project.yaml, typed access to everything
│   ├── generators/       # AI backends
│   │   └── grok.py       # Grok via Playwright (the only one so far)
│   ├── compositor/       # (planned) Mask, layout, export
│   └── cli.py            # Typer CLI entry point
├── projects/             # Client projects (each is self-contained)
│   └── duschwand-roli/   # Roli's shower wall mural
├── app/                  # Next.js web app (composition editor, in progress)
├── docs/
│   ├── PROCESS.md        # High-level workflow
│   └── LEARNINGS.md      # Hard-won findings — READ BEFORE CODING
├── templates/project/    # Template for starting a new client
├── pyproject.toml
└── README.md
```

## Project layout

Every client project is a self-contained directory with a single source of truth
(`project.yaml`) plus numbered generation rounds:

```
projects/<client-name>/
├── project.yaml          # SSOT — dimensions, scenes, characters, style
├── source/               # Immutable inputs
│   ├── photos/
│   ├── references/
│   └── docs/
├── rounds/               # Generation iterations
│   └── 00N-name/
│       ├── manifest.yaml # Date, model, outcome, learnings
│       ├── prompts/
│       ├── outputs/
│       └── notes.md
├── selected/             # Curated best-of (symlinks into rounds/)
│   ├── scenes/
│   └── murals/
├── composites/
└── deliverables/         # Print-ready files
```

## Starting a new client

```bash
cp -r templates/project projects/new-client
# Edit projects/new-client/project.yaml
# Drop photos into projects/new-client/source/photos/
printcraft project info projects/new-client      # sanity check
printcraft generate all-scenes projects/new-client
```

## Active projects

### Duschwand Roli
Cartoon mural for a 2-panel L-corner shower wall (80 + 120 × 200 cm) on a houseboat.
Seven Amphicar owners cruising Lake Garda at sunset in 1960s travel-poster style.
- **Status:** Round 007 (unified mural) in progress
- **Details:** [projects/duschwand-roli/project.yaml](projects/duschwand-roli/project.yaml)

## Hard-won findings

Read [docs/LEARNINGS.md](docs/LEARNINGS.md) before touching generation code.
Key rules:
- **Short prompts only** (~600 chars max). Long prompts trigger Grok's
  photo-edit mode instead of Aurora illustration generation.
- **`page.keyboard.type()`** for prompt entry, never `fill()` or JS setters.
- **Don't composite individually-generated scenes** — use unified generation.
- **One project.yaml per project** — never hard-code scene data in scripts.
