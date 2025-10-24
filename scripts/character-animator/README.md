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
# Generate all characters from CSV
python mass_generate_characters.py characters_200.csv \
    --references reference_images/ref1.jpg reference_images/ref2.jpg \
    --output generated_characters \
    --threads 5

# Generate specific range (rows 1-10)
python mass_generate_characters.py characters_200.csv \
    --references reference_images/ref1.jpg reference_images/ref2.jpg \
    --output generated_characters \
    --start 1 --end 10
```

**Options:**
- `--references`: Reference images to match art style
- `--threads`: Number of parallel generations (default: 3)
- `--start`/`--end`: Generate specific row range from CSV
- `--aspect-ratio`: Image aspect ratio (default: 9:16)
- `--output-format`: jpg or png (default: jpg)

### Step 2: Animate Characters

Create animated versions with different animation types.

```bash
# Animate a single character with all animations
python animate_characters.py path/to/character.jpg \
    --output-folder animated_characters/character_name \
    --animations idle attack damage death \
    --samples 2

# Process entire folder
python animate_characters.py generated_characters/ \
    --output-folder animated_characters \
    --animations idle attack damage death \
    --samples 2 \
    --threads 4
```

**Animation Types:**

| Type | Description | Prompt | Last Frame |
|------|-------------|--------|------------|
| **idle** | Standing idle animation | "The character is standing idle and ready to fight" | Yes (loops back) |
| **attack** | Attack animation | "The character is attacking forward" | Yes (loops back) |
| **damage** | Taking damage | "The character is taking damage and recoiling backwards" | Yes (loops back) |
| **death** | Death animation | "The character dies and falls to the ground" | No (ends on ground) |

**Options:**
- `--animations`: Space-separated list of animations to generate
- `--samples`: Number of samples per animation (default: 2)
- `--threads`: Parallel animations (default: 2)
- `--aspect-ratio`: Video aspect ratio (default: 9:16)

**Output Structure:**
```
animated_characters/
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

For batch processing with consistent settings, use JSON config files instead of command-line arguments.

**9:16 Aspect Ratio (Mobile Portrait)** - `animation_config.json`:
```json
{
  "output_folder": "output",
  "max_concurrent": 10,
  "aspect_ratio": "9:16",
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
      "prompt": "Make this character perform an in game death animation.",
      "samples": 2
    }
  }
}
```

**16:9 Aspect Ratio (Widescreen)** - `animation_config_16-9.json`:
```json
{
  "output_folder": "output",
  "max_concurrent": 10,
  "aspect_ratio": "16:9",
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

**Using config files:**

```bash
# Use default 9:16 config
python animate_characters.py characters/doctor.jpg --config animation_config.json

# Use 16:9 widescreen config
python animate_characters.py characters/doctor.jpg --config animation_config_16-9.json

# Process entire folder with config
python animate_characters.py generated_characters/ --config animation_config.json
```

**Config file benefits:**
- ✅ Consistent prompts across all characters
- ✅ Easy aspect ratio switching (9:16 for mobile, 16:9 for desktop games)
- ✅ Customizable prompts per animation type
- ✅ Configurable sample counts and concurrency
- ✅ Better for batch processing and automation

**When to use which aspect ratio:**

| Aspect Ratio | Use Case | Examples |
|--------------|----------|----------|
| **9:16** | Mobile portrait games, vertical shooters | iOS/Android games, TikTok games |
| **16:9** | Desktop/console games, horizontal layouts | PC games, console games, web games |
| **1:1** | Social media, profile pictures | Instagram, avatars |

### Step 3: Convert to Sprite Atlases

Convert animations into Xcode-compatible `.atlas` sprite folders with optimized, compressed frames.

```bash
# Convert animations to sprite atlases
python trim_and_loop.py manual-saved/doctor \
    --sprites \
    --output doctor-final-animations \
    --duration 3.5 \
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
- ✅ Automatic greenscreen removal
- ✅ PNG optimization and compression
- ✅ Xcode `.atlas` folder format
- ✅ Configurable frame rate (12 fps recommended for smooth, optimized sprites)
- ✅ Configurable compression quality

**Output Structure:**
```
doctor-final-animations/
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

### Step 4: Upload to Cloudflare R2

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

### Example 1: Single Character (Command-line)

Creating and deploying a "doctor" character using command-line arguments:

```bash
# 1. Generate the doctor character
echo "description,filename" > doctor.csv
echo "a sinister doctor with a plague mask and surgical tools,doctor" >> doctor.csv
python mass_generate_characters.py doctor.csv \
    --references refs/style1.jpg refs/style2.jpg \
    --output characters/

# 2. Animate the doctor
python animate_characters.py characters/doctor.jpg \
    --output-folder animated/doctor \
    --animations idle attack damage death \
    --samples 2 \
    --threads 4

# 3. Convert to sprite atlases
python trim_and_loop.py animated/doctor \
    --sprites \
    --output animations/doctor \
    --fps 12 \
    --quality 75

# 4. Upload to R2
python upload_to_r2.py animations/doctor doctor
```

### Example 2: Batch Processing with Config (Mobile Game)

Process multiple characters with consistent settings for a mobile game:

```bash
# 1. Generate multiple characters from CSV
python mass_generate_characters.py characters_200.csv \
    --references refs/mobile_style1.jpg refs/mobile_style2.jpg \
    --output generated_characters/ \
    --start 1 --end 20 \
    --threads 5

# 2. Animate all characters using 9:16 config
for char in generated_characters/*.jpg; do
    python animate_characters.py "$char" --config animation_config.json
done

# 3. Convert all animations to sprite atlases
for char_folder in output/*/; do
    char_name=$(basename "$char_folder")
    python trim_and_loop.py "$char_folder" \
        --sprites \
        --output "animations/$char_name" \
        --fps 12 \
        --quality 75
done

# 4. Upload each character
for char_folder in animations/*/; do
    char_name=$(basename "$char_folder")
    python upload_to_r2.py "$char_folder" "$char_name"
done
```

### Example 3: Desktop Game with Widescreen (16:9)

Create animations optimized for a desktop/console game:

```bash
# 1. Generate characters
python mass_generate_characters.py characters_desktop.csv \
    --references refs/desktop_style.jpg \
    --output characters/ \
    --aspect-ratio 16:9

# 2. Animate with 16:9 config
python animate_characters.py characters/ \
    --config animation_config_16-9.json

# 3. Convert to sprite atlases (higher quality for desktop)
python trim_and_loop.py output/ \
    --sprites \
    --output animations/ \
    --fps 15 \
    --quality 85

# 4. Upload
python upload_to_r2.py animations/ desktop_game_assets
```

## Tips & Best Practices

### Character Generation
- **Reference Images**: Use 2-3 reference images that match your desired art style
- **Descriptions**: Be specific about character appearance and features
- **Batch Size**: Generate in batches of 10-20 to manage API costs
- **Art Style**: Keep reference images consistent for visual coherence

### Animation
- **Samples**: Generate 2-3 samples per animation type for variety
- **Duration**: 4 seconds provides good animation coverage
- **Last Frame**: Idle/attack/damage should loop (use last_frame=True)
- **Death Animation**: Should not loop (use last_frame=False)
- **Parallel Processing**: Use 2-4 threads to speed up batch animations
- **Config Files vs Command-line**:
  - Use **config files** (`animation_config.json`) for:
    - Batch processing multiple characters
    - Consistent settings across projects
    - Team collaboration (version control)
    - Different game platforms (9:16 mobile, 16:9 desktop)
  - Use **command-line args** for:
    - Quick one-off generations
    - Testing and experimentation
    - Overriding specific settings

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
├── characters_200.csv          # Character descriptions
├── reference_images/           # Art style references
├── generated_characters/       # Step 1: Generated images
├── animated_characters/        # Step 2: Animated videos
├── animations/                 # Step 3: Final sprite atlases
└── manual-saved/              # Manually curated/edited animations
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
