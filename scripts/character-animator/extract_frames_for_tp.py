import os
import sys
import subprocess
import argparse
from pathlib import Path

def extract_frames(input_path, output_dir, duration=3.53, remove_greenscreen=False, scale=0.25):
    """
    Extract frames from video for use with TexturePacker
    """
    try:
        print(f"Processing {input_path.name}...")

        # Create frames directory
        frames_dir = output_dir / input_path.stem
        frames_dir.mkdir(parents=True, exist_ok=True)

        # First, trim the video to the specified duration
        temp_trimmed = frames_dir / f"temp_trimmed.mp4"

        print(f"  Trimming to {duration} seconds...")
        trim_cmd = [
            'ffmpeg',
            '-i', str(input_path),
            '-t', str(duration),
            '-c', 'copy',
            '-y',
            str(temp_trimmed)
        ]

        result = subprocess.run(trim_cmd, capture_output=True, text=True)

        if result.returncode != 0:
            # Try without -c copy (re-encode)
            trim_cmd = [
                'ffmpeg',
                '-i', str(input_path),
                '-t', str(duration),
                '-y',
                str(temp_trimmed)
            ]
            result = subprocess.run(trim_cmd, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"  Error trimming: {result.stderr}")
            return False

        # Build filter chain with scaling
        scale_filter = f"scale=iw*{scale}:ih*{scale}"

        # Extract frames with greenscreen removal and scaling if needed
        print(f"  Extracting frames (12 fps, scaled to {int(scale*100)}%)...")
        if remove_greenscreen:
            extract_cmd = [
                'ffmpeg',
                '-i', str(temp_trimmed),
                '-vf', f'fps=12,chromakey=0x00FF00:0.3:0.2,{scale_filter}',
                str(frames_dir / 'frame_%04d.png')
            ]
        else:
            extract_cmd = [
                'ffmpeg',
                '-i', str(temp_trimmed),
                '-vf', f'fps=12,{scale_filter}',
                str(frames_dir / 'frame_%04d.png')
            ]

        result = subprocess.run(extract_cmd, capture_output=True, text=True)

        # Clean up temp file
        if temp_trimmed.exists():
            temp_trimmed.unlink()

        if result.returncode != 0:
            print(f"  Error extracting frames: {result.stderr}")
            return False

        frame_count = len(list(frames_dir.glob('frame_*.png')))
        print(f"  Extracted {frame_count} frames to {frames_dir}")

        # Create .tps file
        tps_path = frames_dir / f"{input_path.stem}.tps"
        tps_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<data version="1.0">
    <struct type="Settings">
        <key>fileFormatVersion</key>
        <int>6</int>
        <key>texturePackerVersion</key>
        <string>7.9.0</string>
        <key>autoSDSettings</key>
        <array/>
        <key>allowRotation</key>
        <false/>
        <key>shapeDebug</key>
        <false/>
        <key>dpi</key>
        <uint>72</uint>
        <key>dataFormat</key>
        <string>json-array</string>
        <key>textureFileName</key>
        <filename>{input_path.stem}.png</filename>
        <key>flipPVR</key>
        <false/>
        <key>pvrQualityLevel</key>
        <uint>3</uint>
        <key>astcQualityLevel</key>
        <uint>2</uint>
        <key>basisUniversalQualityLevel</key>
        <uint>2</uint>
        <key>etc1QualityLevel</key>
        <uint>70</uint>
        <key>etc2QualityLevel</key>
        <uint>70</uint>
        <key>dxtCompressionMode</key>
        <enum type="SettingsBase::DxtCompressionMode">DXT_PERCEPTUAL</enum>
        <key>ditherType</key>
        <enum type="SettingsBase::DitherType">NearestNeighbour</enum>
        <key>backgroundColor</key>
        <uint>0</uint>
        <key>libGdx</key>
        <struct type="LibGDX">
            <key>filtering</key>
            <struct type="LibGDXFiltering">
                <key>x</key>
                <enum type="LibGDXFiltering::Filtering">Linear</enum>
                <key>y</key>
                <enum type="LibGDXFiltering::Filtering">Linear</enum>
            </struct>
        </struct>
        <key>shapePadding</key>
        <uint>0</uint>
        <key>jpgQuality</key>
        <uint>80</uint>
        <key>pngOptimizationLevel</key>
        <uint>1</uint>
        <key>webpQualityLevel</key>
        <uint>101</uint>
        <key>textureSubPath</key>
        <string></string>
        <key>textureFormat</key>
        <enum type="SettingsBase::TextureFormat">png8</enum>
        <key>borderPadding</key>
        <uint>0</uint>
        <key>maxTextureSize</key>
        <QSize>
            <key>width</key>
            <int>8192</int>
            <key>height</key>
            <int>8192</int>
        </QSize>
        <key>fixedTextureSize</key>
        <QSize>
            <key>width</key>
            <int>-1</int>
            <key>height</key>
            <int>-1</int>
        </QSize>
        <key>algorithmSettings</key>
        <struct type="AlgorithmSettings">
            <key>algorithm</key>
            <enum type="AlgorithmSettings::AlgorithmId">MaxRects</enum>
            <key>freeSizeMode</key>
            <enum type="AlgorithmSettings::AlgorithmFreeSizeMode">Best</enum>
            <key>sizeConstraints</key>
            <enum type="AlgorithmSettings::SizeConstraints">AnySize</enum>
            <key>forceSquared</key>
            <false/>
            <key>maxRects</key>
            <struct type="AlgorithmMaxRectsSettings">
                <key>heuristic</key>
                <enum type="AlgorithmMaxRectsSettings::Heuristic">Best</enum>
            </struct>
            <key>basic</key>
            <struct type="AlgorithmBasicSettings">
                <key>sortBy</key>
                <enum type="AlgorithmBasicSettings::SortBy">Best</enum>
                <key>order</key>
                <enum type="AlgorithmBasicSettings::Order">Ascending</enum>
            </struct>
            <key>polygon</key>
            <struct type="AlgorithmPolygonSettings">
                <key>alignToGrid</key>
                <uint>1</uint>
            </struct>
        </struct>
        <key>dataFileNames</key>
        <map type="GFileNameMap">
            <key>data</key>
            <struct type="DataFile">
                <key>name</key>
                <filename>{input_path.stem}.json</filename>
            </struct>
        </map>
        <key>multiPackMode</key>
        <enum type="SettingsBase::MultiPackMode">MultiPackOff</enum>
        <key>forceIdenticalLayout</key>
        <false/>
        <key>outputFormat</key>
        <enum type="SettingsBase::OutputFormat">RGBA8888</enum>
        <key>alphaHandling</key>
        <enum type="SettingsBase::AlphaHandling">ClearTransparentPixels</enum>
        <key>contentProtection</key>
        <struct type="ContentProtection">
            <key>key</key>
            <string></string>
        </struct>
        <key>autoAliasEnabled</key>
        <true/>
        <key>trimSpriteNames</key>
        <false/>
        <key>prependSmartFolderName</key>
        <false/>
        <key>autodetectAnimations</key>
        <true/>
        <key>globalSpriteSettings</key>
        <struct type="SpriteSettings">
            <key>scale</key>
            <double>1</double>
            <key>scaleMode</key>
            <enum type="ScaleMode">Smooth</enum>
            <key>extrude</key>
            <uint>1</uint>
            <key>trimThreshold</key>
            <uint>1</uint>
            <key>trimMargin</key>
            <uint>1</uint>
            <key>trimMode</key>
            <enum type="SpriteSettings::TrimMode">None</enum>
            <key>tracerTolerance</key>
            <int>200</int>
            <key>heuristicMask</key>
            <false/>
            <key>defaultPivotPoint</key>
            <point_f>0.5,0.5</point_f>
            <key>writePivotPoints</key>
            <false/>
        </struct>
        <key>individualSpriteSettings</key>
        <map type="IndividualSpriteSettingsMap">
        </map>
        <key>fileList</key>
        <array>
            <filename>.</filename>
        </array>
        <key>ignoreFileList</key>
        <array/>
        <key>replaceList</key>
        <array/>
    </struct>
</data>
"""

        with open(tps_path, 'w') as f:
            f.write(tps_content)

        print(f"  Created TexturePacker project: {tps_path.name}")
        return True

    except Exception as e:
        print(f"  Error: {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Extract frames from videos for TexturePacker")
    parser.add_argument("input_folder", help="Input folder containing videos")
    parser.add_argument("--output", "-o", default="frames_output", help="Output folder for frames")
    parser.add_argument("--duration", "-d", type=float, default=3.53, help="Duration to trim to (default: 3.53)")
    parser.add_argument("--remove-greenscreen", "-g", action="store_true", help="Remove greenscreen background")
    parser.add_argument("--scale", "-s", type=float, default=0.25, help="Scale factor for frames (default: 0.25 = 25%%)")

    args = parser.parse_args()

    input_folder = Path(args.input_folder)
    output_folder = Path(args.output)

    if not input_folder.exists():
        print(f"Error: Folder '{input_folder}' not found")
        sys.exit(1)

    output_folder.mkdir(parents=True, exist_ok=True)

    # Get all video files recursively
    video_extensions = {'.mp4', '.mov', '.avi', '.mkv'}
    videos = list(input_folder.rglob('*'))
    videos = [f for f in videos if f.is_file() and f.suffix.lower() in video_extensions]

    if not videos:
        print(f"Error: No videos found in '{input_folder}'")
        sys.exit(1)

    print(f"Found {len(videos)} videos to process")
    print(f"Extracting frames at 12 fps, scaled to {int(args.scale*100)}%")
    if args.remove_greenscreen:
        print("Removing greenscreen background")
    print(f"Output folder: {output_folder}\n")

    success_count = 0
    failed_count = 0

    for video in videos:
        if extract_frames(video, output_folder, args.duration, args.remove_greenscreen, args.scale):
            success_count += 1
        else:
            failed_count += 1

    print(f"\n{'='*60}")
    print(f"Complete! Processed {success_count}/{len(videos)} videos successfully")
    if failed_count > 0:
        print(f"Failed: {failed_count}")
    print(f"Output: {output_folder}")
    print(f"\nOpen the .tps files in TexturePacker GUI to create sprite sheets")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
