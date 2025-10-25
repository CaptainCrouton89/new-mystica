# Character Animation Pipeline

A complete pipeline for generating game characters, animating them, and exporting as sprite atlases for Xcode/SpriteKit.

## Overview

This pipeline enables you to:
1. **Generate** character images from text descriptions using AI
2. **Animate** characters with multiple animation types (idle, attack, damage, death)
3. **Process** animations into optimized sprite atlases for Xcode
4. **Upload** finished animations to Cloudflare R2 storage

## Prerequisites

### Required Tools
- Python 3.11+
- ffmpeg (for video processing)
- Replicate API key
- Cloudflare R2 credentials (optional, for uploading)

### Installation

```bash
# Install Python dependencies
pip install replicate pillow python-dotenv boto3

# Install ffmpeg (macOS)
brew install ffmpeg

# Or on Linux
# sudo apt-get install ffmpeg
```

### Environment Setup

Create a `.env` file with your credentials:

```env
# Replicate API key (required)
REPLICATE_API_TOKEN=your_replicate_token

# Cloudflare R2 credentials (optional, for uploads)
CLOUDFLARE_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_ENDPOINT=https://your_account.r2.cloudflarestorage.com
```

## Working Directory Structure

All work is organized in the `character-animations/` base directory (git-ignored):

```
character-animations/
├── generated/              # Step 1: Generated character images (9:16)
│   └── batch_YYYYMMDD_HHMMSS/
│       ├── character1.jpg
│       └── character2.jpg
├── processed/              # Step 2: Processed images (bg removed, greenscreen, 16:9)
│   ├── character1-greenscreen.png
│   └── character2-greenscreen.png
├── animated/               # Step 3: Animated videos (16:9)
│   └── batch_YYYYMMDD_HHMMSS/
│       └── character1/
│           ├── idle/
│           ├── attack/
│           ├── damage/
│           └── death/
└── sprites/                # Step 4: Final sprite atlases
    └── character1/
        ├── idle_sample1.atlas/
        ├── attack_sample1.atlas/
        └── ...
```

**Benefits:**
- ✅ Everything in one place, easy to find
- ✅ Automatically git-ignored (won't commit large files)
- ✅ Clean separation between generation stages
- ✅ Can still override with `--output` flag

## Recommended Aspect Ratio Workflow

**Best Practice:** Generate in 9:16, process to 16:9, animate, convert to sprites

1. **Generate characters at 9:16** - Captures full body detail in portrait mode
2. **Process to 16:9** - Remove background, add greenscreen, convert to landscape
3. **Animate at 16:9** - Better for game viewing and sprite sheets
4. **Convert to sprites** - Greenscreen gets keyed out, creating transparent sprites

This gives you maximum flexibility: tall character detail from generation, wide viewing angle for gameplay, and clean transparent sprites.

## Workflow

### Step 1: Generate Characters

Generate character images from text descriptions using the `characters_200.csv` file.

**CSV Format:**
```csv
description,filename
a menacing alien warrior with glowing purple armor,scifi_alien_warrior_001
a robotic assassin with red glowing eyes,scifi_robot_assassin_002
```

**Generate characters:**

```bash
# Generate all characters from CSV (defaults to character-animations/generated/)
python mass_generate_characters.py characters_200.csv \
    --references reference_images/ref1.jpg reference_images/ref2.jpg \
    --concurrent 5

# Generate with 9:16 aspect ratio (recommended - captures full body)
python mass_generate_characters.py characters_200.csv \
    --references reference_images/ref1.jpg reference_images/ref2.jpg \
    --aspect-ratio 9:16

# Custom output location (optional)
python mass_generate_characters.py characters_200.csv \
    --references reference_images/ref1.jpg reference_images/ref2.jpg \
    --output custom_folder
```

**Options:**
- `--references`, `-r`: Reference images to match art style (required)
- `--output`, `-o`: Output folder (default: `character-animations/generated`)
- `--concurrent`, `-c`: Number of parallel generations (default: 5)
- `--aspect-ratio`: Image aspect ratio (default: 9:16)
- `--format`: jpg or png (default: jpg)

### Step 2: Process Images (Remove Background + Greenscreen)

Convert generated images to greenscreen format for animation. This removes the background and places characters on a green screen (which gets keyed out during sprite conversion).

**Recommended:** Process to 16:9 landscape for better game viewing.

```bash
# Process all images to 16:9 with greenscreen (defaults to character-animations/processed/)
python process_folder.py character-animations/generated/batch_*/ --landscape

# Process only first 3 images (for testing)
python process_folder.py character-animations/generated/batch_*/ --landscape --limit 3

# Custom output location
python process_folder.py character-animations/generated/batch_*/ \
    --landscape \
    --output character-animations/processed
```

**What this does:**
1. Removes background using Replicate's `bria/remove-background`
2. Places character on greenscreen background (chroma key green: #00FF00)
3. Converts to 16:9 landscape (1280x720) or 9:16 portrait (720x1280)
4. Outputs as PNG with `-greenscreen` suffix

**Options:**
- `--output`, `-o`: Output folder (default: `character-animations/processed`)
- `--landscape`: Use 16:9 aspect ratio (default: 9:16) - **Recommended for games**
- `--limit`: Limit number of images to process (useful for testing)

### Step 3: Animate Characters

Animate the processed greenscreen images. The greenscreen background will be removed during sprite conversion.

```bash
# Animate processed greenscreen images with 16:9 config
python animate_characters.py character-animations/processed/character-greenscreen.png \
    --config animation_config_16-9.json

# Or use command-line args
python animate_characters.py character-animations/processed/character-greenscreen.png \
    --animations idle attack damage death \
    --samples 2 \
    --aspect-ratio 16:9

# Process entire folder of greenscreen images
python animate_characters.py character-animations/processed/ \
    --config animation_config_16-9.json
```

**Animation Types:**

| Type | Description | Prompt | Last Frame |
|------|-------------|--------|------------|
| **idle** | Standing idle animation | "The character is standing idle and ready to fight" | Yes (loops back) |
| **attack** | Attack animation | "The character is attacking forward" | Yes (loops back) |
| **damage** | Taking damage | "The character is taking damage and recoiling backwards" | Yes (loops back) |
| **death** | Death animation | "The character dies and falls to the ground" | No (ends on ground) |

**Command-Line Options:**
- `--animations`: Space-separated list of animations to generate (required if no config)
- `--samples`: Number of samples per animation (default: 2)
- `--threads`: Number of concurrent threads (default: 2)
- `--aspect-ratio`: Video aspect ratio (default: **16:9**, override with `9:16` if needed)
- `--output-folder`: Output folder for animations (default: `character-animations/animated`)
- `--config`: JSON config file with animation settings (alternative to command-line args)
- `--resume`: Resume from existing batch folder (e.g., `character-animations/animated/batch_20241024_140805`)
- `--force`: Force regenerate all animations, even if they already exist

**Resuming Failed Animations:**

Animations can fail due to API timeouts, content moderation, or rate limits. The script automatically skips existing animations, so you can simply re-run to generate missing ones:

```bash
# Resume from existing batch (only generates missing animations)
python animate_characters.py character-animations/processed/ \
    --config animation_config.json \
    --resume character-animations/animated/batch_20241024_140805

# Force regenerate everything (ignores existing files)
python animate_characters.py character-animations/processed/ \
    --config animation_config.json \
    --resume character-animations/animated/batch_20241024_140805 \
    --force
```

The script will:
- ✅ Skip animations that already exist
- ✅ Only generate missing animations
- ✅ Show progress (e.g., "Skipped 16 existing animations")

**Output Structure:**
```
character-animations/animated/
└── batch_YYYYMMDD_HHMMSS/
    └── character_name/
        ├── idle/
        │   ├── idle_sample1.mp4
        │   └── idle_sample2.mp4
        ├── attack/
        │   ├── attack_sample1.mp4
        │   └── attack_sample2.mp4
        ├── damage/
        │   └── damage_sample1.mp4
        └── death/
            └── death_sample1.mp4
```

#### Using Animation Config Files

For batch processing with consistent settings, use JSON config files. Config files contain animation prompts, sample counts, and concurrency settings. **Aspect ratio is specified via command-line** (default: 16:9).

**Animation Config** - `animation_config.json`:
```json
{
  "output_folder": "character-animations/animated",
  "max_concurrent": 10,
  "animations": {
    "idle": {
      "prompt": "Game animation: The character is idle, breathing gently and swaying slightly as if waiting.",
      "samples": 2
    },
    "attack": {
      "prompt": "Make this character perform an in game attack animation.",
      "samples": 2
    },
    "damage": {
      "prompt": "Make this character appear as if they are taking damage in game and in pain.",
      "samples": 2
    },
    "death": {
      "prompt": "Make this character perform an in game death animation by falling to the floor with x eyes closed.",
      "samples": 2
    }
  }
}
```

**Note:** Aspect ratio is NOT in the config file. It's controlled via `--aspect-ratio` flag (default: 16:9).

**Using config files:**

```bash
# Use config with default 16:9 aspect ratio
python animate_characters.py character-animations/processed/ --config animation_config.json

# Override to 9:16 portrait (for mobile games)
python animate_characters.py character-animations/processed/ \
    --config animation_config.json \
    --aspect-ratio 9:16

# Override output folder when using config
python animate_characters.py character-animations/processed/ \
    --config animation_config.json \
    --output-folder custom_output
```

**Config file benefits:**
- ✅ Consistent prompts across all characters
- ✅ Customizable prompts per animation type
- ✅ Configurable sample counts and concurrency
- ✅ Better for batch processing and automation
- ✅ Aspect ratio controlled via command-line (flexible per run)

**When to use which aspect ratio:**

| Aspect Ratio | Use Case | Examples | How to Use |
|--------------|----------|----------|------------|
| **16:9** | Desktop/console games, horizontal layouts (DEFAULT) | PC games, console games, web games | Default, no flag needed |
| **9:16** | Mobile portrait games, vertical shooters | iOS/Android games, TikTok games | `--aspect-ratio 9:16` |
| **1:1** | Social media, profile pictures | Instagram, avatars | `--aspect-ratio 1:1` |

### Step 4: Convert to Sprite Atlases

Convert animations into Xcode-compatible `.atlas` sprite folders with optimized, compressed frames. The greenscreen background is automatically removed during this step.

```bash
# Convert animations to sprite atlases (greenscreen gets keyed out automatically)
python trim_and_loop.py character-animations/animated/character_name \
    --sprites \
    --output character-animations/sprites/character_name \
    --duration 3.5 \
    --fps 12 \
    --quality 75

# Process without specifying output (creates character_name-sprites in parent folder)
python trim_and_loop.py character-animations/animated/character_name \
    --sprites \
    --fps 12 \
    --quality 75
```

**Options:**
- `--sprites`, `-s`: Output as .atlas sprite folders for Xcode
- `--output`, `-o`: Custom output folder name
- `--duration`, `-d`: Video duration to trim (default: 3.5 seconds)
- `--fps`, `-f`: Frame rate for sprites (default: 12 fps)
- `--quality`, `-q`: Compression quality 0-100 (default: 75, higher = better quality)
- `--remove-greenscreen`, `-g`: Remove greenscreen for videos (sprites always remove greenscreen)

**Sprite Features:**
- ✅ **Automatic greenscreen removal** (from Step 2 processing)
- ✅ PNG optimization and compression
- ✅ Xcode `.atlas` folder format
- ✅ Configurable frame rate (12 fps recommended for smooth, optimized sprites)
- ✅ Configurable compression quality
- ✅ Transparent PNG output (background removed)

**Output Structure:**
```
character-animations/sprites/
└── character_name/
    ├── idle/
    │   ├── idle_sample1.atlas/
    │   │   ├── frame_0000.png
    │   │   ├── frame_0001.png
    │   │   └── ...
    │   └── idle_sample2.atlas/
    ├── attack/
    │   └── attack_sample1.atlas/
    ├── damage/
    │   └── damage_sample1.atlas/
    └── death/
        └── death_sample1.atlas/
```

**Using in Xcode:**
1. Drag the `.atlas` folders into your Xcode project
2. Xcode automatically generates sprite atlases at build time
3. Load in SpriteKit:
```swift
let atlas = SKTextureAtlas(named: "idle_sample1")
let frames = (0..<atlas.textureNames.count).map {
    atlas.textureNamed("frame_\(String(format: "%04d", $0))")
}
let animation = SKAction.animate(with: frames, timePerFrame: 1.0/12.0)
```

### Step 5: Upload to Cloudflare R2

Upload finished animations to cloud storage.

```bash
# Upload animations to R2
python upload_to_r2.py animations/doctor doctor

# This uploads to: mystica-assets/monsters/animations/doctor/
```

**Output:**
- Uploads all files preserving folder structure
- Shows progress: `[42/306] ✓ idle/idle_sample1.atlas/frame_0010.png`
- Files available at: `https://your-r2-domain.r2.dev/monsters/animations/doctor/...`

**Script Usage:**
```bash
python upload_to_r2.py <local_folder> <monster_name>
```

The script automatically:
- Preserves folder structure
- Sets correct content types (image/png)
- Shows upload progress
- Uploads to: `mystica-assets/monsters/animations/{monster_name}/`

## Complete Example Workflows

### Example 1: Single Character (Complete 9:16 → 16:9 Workflow)

Creating and deploying a "doctor" character using the recommended workflow:

```bash
# 1. Generate the doctor character at 9:16 (captures full body detail)
echo "description,filename" > doctor.csv
echo "a sinister doctor with a plague mask and surgical tools,doctor" >> doctor.csv
python mass_generate_characters.py doctor.csv \
    --references refs/style1.jpg refs/style2.jpg \
    --aspect-ratio 9:16
# Output: character-animations/generated/batch_*/doctor.jpg

# 2. Process: Remove background + add greenscreen + convert to 16:9
python process_folder.py character-animations/generated/batch_*/ --landscape
# Output: character-animations/processed/doctor-greenscreen.png

# 3. Animate at 16:9 (greenscreen background for keying, 16:9 is default)
python animate_characters.py character-animations/processed/doctor-greenscreen.png \
    --config animation_config.json
# Output: character-animations/animated/doctor-greenscreen/

# 3b. If some animations fail, resume to fill in missing ones
python animate_characters.py character-animations/processed/doctor-greenscreen.png \
    --config animation_config.json \
    --resume character-animations/animated/doctor-greenscreen

# 4. Convert to sprite atlases (greenscreen automatically removed)
python trim_and_loop.py character-animations/animated/doctor-greenscreen \
    --sprites \
    --output character-animations/sprites/doctor \
    --fps 12 \
    --quality 75

# 5. Upload to R2
python upload_to_r2.py character-animations/sprites/doctor doctor
```

### Example 2: Batch Processing (Complete 9:16 → 16:9 Workflow)

Process multiple characters using the recommended aspect ratio workflow:

```bash
# 1. Generate multiple characters at 9:16 (full body capture)
python mass_generate_characters.py characters_200.csv \
    --references refs/style1.jpg refs/style2.jpg \
    --aspect-ratio 9:16 \
    --concurrent 5
# Output: character-animations/generated/batch_*/

# 2. Process all: Remove backgrounds + greenscreen + convert to 16:9
python process_folder.py character-animations/generated/batch_*/ --landscape
# Output: character-animations/processed/*-greenscreen.png

# 3. Animate all greenscreen images (16:9 is default)
python animate_characters.py character-animations/processed/ --config animation_config.json
# Output: character-animations/animated/batch_*/

# 3b. If some animations fail, resume to fill in missing ones
python animate_characters.py character-animations/processed/ \
    --config animation_config.json \
    --resume character-animations/animated/batch_20241024_140805

# 4. Convert all animations to sprite atlases (greenscreen removed automatically)
latest_batch=$(ls -td character-animations/animated/batch_* | head -1)
for char_folder in "$latest_batch"/*/; do
    char_name=$(basename "$char_folder" | sed 's/-greenscreen$//')
    python trim_and_loop.py "$char_folder" \
        --sprites \
        --output "character-animations/sprites/$char_name" \
        --fps 12 \
        --quality 75
done

# 5. Upload each character
for char_folder in character-animations/sprites/*/; do
    char_name=$(basename "$char_folder")
    python upload_to_r2.py "$char_folder" "$char_name"
done
```

### Example 3: Pure 16:9 Workflow (Desktop/Console Games)

For games that need 16:9 from start to finish:

```bash
# 1. Generate characters at 16:9 (if you want widescreen from the start)
python mass_generate_characters.py characters_desktop.csv \
    --references refs/desktop_style.jpg \
    --aspect-ratio 16:9
# Output: character-animations/generated/batch_*/

# 2. Animate with 16:9 config
python animate_characters.py character-animations/generated/batch_*/ \
    --config animation_config_16-9.json

# 3. Convert to sprite atlases (higher quality for desktop)
latest_batch=$(ls -td character-animations/animated/batch_* | head -1)
python trim_and_loop.py "$latest_batch" \
    --sprites \
    --output character-animations/sprites/ \
    --fps 15 \
    --quality 85

# 4. Upload
python upload_to_r2.py character-animations/sprites/ desktop_game_assets
```

## Tips & Best Practices

### Aspect Ratio Strategy
- **9:16 → 16:9 (Recommended)**: Generate at 9:16 for full body detail, animate at 16:9 for gameplay
- **Pure 16:9**: For desktop games that need widescreen from the start
- **Pure 9:16**: For mobile portrait games only

### Character Generation
- **Reference Images**: Use 2-3 reference images that match your desired art style
- **Descriptions**: Be specific about character appearance and features
- **Aspect Ratio**: Use 9:16 for maximum body detail (recommended)
- **Batch Size**: Generate in batches of 10-20 to manage API costs
- **Art Style**: Keep reference images consistent for visual coherence

### Animation
- **Aspect Ratio**: Use 16:9 for animations even if generated at 9:16 (better game viewing)
- **Samples**: Generate 2-3 samples per animation type for variety
- **Duration**: 4 seconds provides good animation coverage
- **Last Frame**: Idle/attack/damage should loop (use last_frame=True)
- **Death Animation**: Should not loop (use last_frame=False)
- **Parallel Processing**: Use 2-4 threads to speed up batch animations
- **Config Files vs Command-line**:
  - Use **config files** (`animation_config_16-9.json`) for:
    - Batch processing multiple characters
    - Consistent settings across projects
    - Team collaboration (version control)
    - Recommended: 16:9 config for most game types
  - Use **command-line args** for:
    - Quick one-off generations
    - Testing and experimentation
    - Overriding specific settings (e.g., `--aspect-ratio 16:9`)

### Sprite Conversion
- **Frame Rate**: 12 fps is optimal for smooth gameplay while keeping file size reasonable
- **Quality**: 75 provides good balance between quality and file size
  - Use 85-95 for high-quality sprites
  - Use 50-70 for smaller file sizes
- **Duration**: Trim to 3-4 seconds for looping animations
- **Greenscreen**: Automatically removed for sprites to support transparency

### File Organization
```
project/
├── characters_200.csv                  # Character descriptions
├── reference_images/                   # Art style references
├── animation_config.json               # Animation config (prompts, samples, concurrency)
└── character-animations/               # Working directory (git-ignored)
    ├── generated/                      # Step 1: Generated images (9:16)
    │   └── batch_YYYYMMDD_HHMMSS/
    ├── processed/                      # Step 2: Processed (bg removed, greenscreen, 16:9)
    │   └── *-greenscreen.png
    ├── animated/                       # Step 3: Animated videos (16:9 by default)
    │   └── batch_YYYYMMDD_HHMMSS/
    └── sprites/                        # Step 4: Final sprite atlases (transparent)
        └── character_name/
```

## Troubleshooting

### Common Issues

**"ModuleNotFoundError: No module named 'replicate'"**
```bash
pip install replicate pillow python-dotenv boto3
```

**"ffmpeg: command not found"**
```bash
brew install ffmpeg  # macOS
sudo apt-get install ffmpeg  # Linux
```

**"Error: Missing R2 credentials"**
- Check that `.env` file exists with all required R2 variables
- Verify credentials are correct in Cloudflare dashboard

**Upload timeout**
- Large sprite atlases may take several minutes to upload
- Script runs in background, check `upload_log.txt` for progress

**Out of memory during generation**
- Reduce `--threads` parameter
- Process smaller batches
- Close other applications

## Performance

**Generation Time:**
- Character generation: ~30-60 seconds per character
- Animation: ~2-3 minutes per animation
- Sprite processing: ~10-20 seconds per animation
- Upload: ~2-3 seconds per frame

**File Sizes:**
- Generated character: ~500KB - 2MB (jpg)
- Animated video: ~2-5MB per animation
- Sprite atlas (45 frames @ 12fps): ~40-80MB
- Optimized sprite frame: ~800KB - 1.2MB per PNG

**Optimization:**
- Use `--quality 50-70` for smaller sprites (~50% size reduction)
- Reduce `--fps` to 10 for fewer frames (~17% size reduction)
- Generate fewer samples (1-2 instead of 3-4)

## API Costs

Replicate API usage (approximate):
- Character generation (nano-banana): ~$0.01 per character
- Animation (veo-3.1-fast): ~$0.05 per animation
- Full character set (4 animations): ~$0.20 per character

## License

This pipeline uses:
- **google/nano-banana** for character generation
- **google/veo-3.1-fast** for animation
- **Cloudflare R2** for storage

Ensure you comply with each service's terms of use.
