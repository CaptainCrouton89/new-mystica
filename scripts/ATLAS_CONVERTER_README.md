# Atlas Converter Script

This script converts PNG animation frames stored in R2 to proper SpriteKit atlas files and uploads them back to R2 for better performance.

## Prerequisites

1. **Xcode Command Line Tools**: Required for the `textureatlas` command

   ```bash
   xcode-select --install
   ```

2. **R2 Credentials**: Set environment variables

   ```bash
   export R2_ACCESS_KEY_ID="your_access_key"
   export R2_SECRET_ACCESS_KEY="your_secret_key"
   ```

3. **Dependencies**: Install required packages
   ```bash
   cd scripts
   pnpm install
   ```

## Usage

### Convert by Monster and Animation Type

```bash
# Convert doctor idle animation
tsx convert-to-atlas.ts --monster doctor --animation idle

# Convert doctor attack animation with specific frame count
tsx convert-to-atlas.ts --monster doctor --animation attack --frames 45
```

### Convert by Full R2 Path

```bash
# Convert using full path to atlas folder
tsx convert-to-atlas.ts --path monsters/animations/doctor/idle/idle_sample1.atlas
```

## What It Does

1. **Downloads PNG Frames**: Fetches all PNG frames from the specified R2 path
2. **Auto-Detects Frame Count**: Tests URLs to find the actual number of frames
3. **Creates Atlas File**: Uses SpriteKit's `textureatlas` tool to create binary atlas
4. **Generates Metadata**: Creates JSON file with animation information
5. **Uploads to R2**: Saves both atlas file and metadata back to R2

## Output Structure

After conversion, your R2 bucket will contain:

```
monsters/animations/doctor/idle/
├── doctor_idle.atlas          # Binary atlas file
├── doctor_idle_metadata.json  # Animation metadata
└── idle_sample1.atlas/        # Original PNG frames (unchanged)
    ├── frame_0000.png
    ├── frame_0001.png
    └── ...
```

## Metadata Format

The generated metadata JSON contains:

```json
{
  "monsterType": "doctor",
  "animationType": "idle",
  "frameCount": 45,
  "duration": 3.75,
  "frameRate": 12.0,
  "atlasFileName": "doctor_idle.atlas",
  "createdAt": "2025-01-25T10:30:00.000Z"
}
```

## Performance Benefits

- **Faster Loading**: Single HTTP request instead of 45+ individual requests
- **Better Compression**: Atlas files are optimized and compressed
- **Reduced Network Overhead**: Less HTTP headers and connection overhead
- **SpriteKit Optimization**: Native atlas loading is highly optimized

## Troubleshooting

### textureatlas Command Not Found

```bash
# Install Xcode command line tools
xcode-select --install

# Verify installation
which textureatlas
```

### R2 Authentication Issues

```bash
# Check environment variables
echo $R2_ACCESS_KEY_ID
echo $R2_SECRET_ACCESS_KEY
```

### Alternative Atlas Creation

If `textureatlas` doesn't work, you can use:

- **TexturePacker**: Commercial tool with command line interface
- **Online Atlas Generators**: Various web-based tools
- **Custom Implementation**: Modify the script to use different tools

## Example Workflow

1. **Convert All Doctor Animations**:

   ```bash
   tsx convert-to-atlas.ts --monster doctor --animation idle
   tsx convert-to-atlas.ts --monster doctor --animation attack
   ```

2. **Update iOS App**: Modify `R2AnimationLoader` to use atlas files instead of individual PNGs

3. **Test Performance**: Compare loading times between PNG and atlas approaches

## Notes

- Original PNG frames are preserved in their original location
- Atlas files are created alongside the original frames
- The script automatically detects frame counts by testing URLs
- Temporary files are cleaned up after processing
