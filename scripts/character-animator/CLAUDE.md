# CLAUDE.md - Character Animation Pipeline

## Overview

Python-based character animation pipeline for game assets. Generates character images via AI, animates them with multiple action types (idle, attack, damage, death), processes into sprite atlases, and uploads to R2.

## Key Workflow

**Generate → Animate → Process → Upload**

1. **Generate characters** from descriptions using Replicate API (image generation models)
2. **Animate** static images using Replicate Veo (video generation from images)
3. **Process** videos into sprite sheets (trim, loop, consolidate frames)
4. **Upload** finished sprites to Cloudflare R2

## Technologies & Dependencies

- **Python 3.11+** (primary language, not TypeScript)
- **Replicate API** - Image/video generation (Veo model)
- **FFmpeg** - Video processing, frame extraction, trimming
- **Pillow** - Image manipulation
- **boto3** - R2/S3 operations
- **python-dotenv** - Environment variable loading

## Environment Variables

```env
REPLICATE_API_TOKEN          # Required for all image/video generation
CLOUDFLARE_ACCOUNT_ID        # For R2 uploads (optional)
R2_ACCESS_KEY_ID             # For R2 uploads (optional)
R2_SECRET_ACCESS_KEY         # For R2 uploads (optional)
R2_ENDPOINT                  # R2 endpoint URL
```

## Core Scripts

| Script | Purpose |
|--------|---------|
| `animate_characters.py` | Main orchestration: animates images with Replicate Veo |
| `mass_generate_characters.py` | Batch character generation from CSV |
| `process_image.py` | Single-image processing (trim, resize, consolidate) |
| `process_folder.py` | Batch process multiple animation folders |
| `trim_and_loop.py` | Video trimming and frame looping logic |
| `upload_to_r2.py` | R2 upload with progress tracking |

## Configuration

- `animation_config.json` - Animation parameters (prompts, durations, FPS, frame counts)
- `characters_200.csv` - Character definition data (used for batch generation)

## Important Patterns

- **Concurrent processing**: ThreadPoolExecutor for parallel animation/processing
- **Error handling**: Try-catch with logging, continues on individual failures
- **File organization**: Input images in dedicated folders, outputs in timestamped directories
- **16:9 aspect ratio**: Default for animations (greenscreen-optimized)
- **Frame consolidation**: Combines multiple animation types into single sprite sheet

## Notes

- FFmpeg must be installed (`brew install ffmpeg` on macOS)
- Replicate Veo generation takes ~2-5 minutes per animation (video generation is slow)
- R2 uploads only run with explicit `--upload` flag
- Python-only subsystem—separate from TypeScript backend/frontend
