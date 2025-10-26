import os
import sys
import subprocess
import argparse
import json
import math
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed
import multiprocessing

def create_sprite_sheet(frames, output_path, json_path, compression_quality=75):
    """
    Create a sprite sheet from frames and save metadata as JSON

    Args:
        frames: List of PIL Image objects
        output_path: Path to save sprite sheet PNG
        json_path: Path to save metadata JSON
        compression_quality: PNG compression quality 0-100
    """
    from PIL import Image

    if not frames:
        return False

    # Get frame dimensions (assume all frames same size)
    frame_width, frame_height = frames[0].size
    num_frames = len(frames)

    # Calculate grid layout (roughly square)
    cols = math.ceil(math.sqrt(num_frames))
    rows = math.ceil(num_frames / cols)

    # Create sprite sheet
    sheet_width = frame_width * cols
    sheet_height = frame_height * rows
    sprite_sheet = Image.new('RGBA', (sheet_width, sheet_height), (0, 0, 0, 0))

    # Place frames in grid and build metadata
    frame_metadata = []
    for idx, frame in enumerate(frames):
        col = idx % cols
        row = idx // cols
        x = col * frame_width
        y = row * frame_height

        sprite_sheet.paste(frame, (x, y))

        frame_metadata.append({
            "frame": idx,
            "x": x,
            "y": y,
            "width": frame_width,
            "height": frame_height
        })

    # Save sprite sheet
    compress_level = int(9 - (compression_quality / 100) * 9)
    sprite_sheet.save(output_path, 'PNG', compress_level=compress_level, optimize=True)

    # Save metadata JSON
    metadata = {
        "frames": frame_metadata,
        "meta": {
            "image": output_path.name,
            "size": {"w": sheet_width, "h": sheet_height},
            "frameSize": {"w": frame_width, "h": frame_height},
            "frameCount": num_frames,
            "cols": cols,
            "rows": rows
        }
    }

    with open(json_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    return True

def trim_and_loop_video(input_path, output_path, duration=3.5, remove_greenscreen=False, sprite_output=False, fps=12, compression_quality=75):
    """
    Trim video to specified duration and loop it once
    Optionally remove greenscreen and/or export as sprite sheet

    Args:
        fps: Frame rate for sprite extraction (default: 12)
        compression_quality: PNG compression level 0-100 (default: 75, higher = better quality)
    """
    try:
        print(f"Processing {input_path.name}...")

        # First, trim the video to the specified duration
        temp_trimmed = output_path.parent / f"temp_trimmed_{output_path.stem}.mp4"

        # Build ffmpeg command - just trim for now, greenscreen removal happens during frame extraction
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

        if sprite_output:
            # For sprite output, always remove greenscreen and create sprite sheet
            print(f"  Extracting frames for sprite sheet ({fps} fps)...")

            frames_dir = output_path.parent / f"frames_{output_path.stem}"
            frames_dir.mkdir(exist_ok=True)

            # Extract frames with greenscreen removal (always enabled for sprites)
            # Use chromakey with proper alpha channel output
            # similarity=0.3, blend=0.1 for clean keying
            extract_cmd = [
                'ffmpeg',
                '-i', str(temp_trimmed),
                '-vf', f'fps={fps},chromakey=0x00FF00:0.3:0.1,format=rgba',
                '-pix_fmt', 'rgba',
                '-y',
                str(frames_dir / 'frame_%04d.png')
            ]

            result = subprocess.run(extract_cmd, capture_output=True, text=True)

            if result.returncode != 0:
                print(f"  Error extracting frames: {result.stderr}")
                return False

            # Load frames into memory
            print(f"  Creating sprite sheet...")
            from PIL import Image

            # Get all frame files
            frame_files = sorted(frames_dir.glob('frame_*.png'))

            if not frame_files:
                print(f"  Error: No frames extracted")
                return False

            # Load all frames
            frames = [Image.open(f) for f in frame_files]

            # Create sprite sheet PNG and JSON
            sprite_png_path = output_path.with_suffix('.png')
            sprite_json_path = output_path.with_suffix('.json')

            success = create_sprite_sheet(frames, sprite_png_path, sprite_json_path, compression_quality)

            # Save first frame as base.png
            if frames:
                base_png_path = output_path.parent / 'base.png'
                frames[0].save(base_png_path, 'PNG')
                print(f"  Saved base frame: {base_png_path.name}")

            # Close all frames
            for frame in frames:
                frame.close()

            # Clean up temp frames directory
            import shutil
            shutil.rmtree(frames_dir)

            if success:
                print(f"  Saved sprite sheet: {sprite_png_path.name} ({len(frames)} frames)")
                print(f"  Saved metadata: {sprite_json_path.name}")
            else:
                print(f"  Error creating sprite sheet")
                return False
        else:
            # Loop the trimmed video
            print(f"  Looping video...")

            if remove_greenscreen:
                loop_cmd = [
                    'ffmpeg',
                    '-i', str(temp_trimmed),
                    '-filter_complex', '[0:v][0:v]concat=n=2:v=1[outv]',
                    '-map', '[outv]',
                    '-pix_fmt', 'yuva420p',
                    '-y',
                    str(output_path)
                ]
            else:
                loop_cmd = [
                    'ffmpeg',
                    '-i', str(temp_trimmed),
                    '-filter_complex', '[0:v][0:v]concat=n=2:v=1[outv]',
                    '-map', '[outv]',
                    '-y',
                    str(output_path)
                ]

            result = subprocess.run(loop_cmd, capture_output=True, text=True)

            if result.returncode != 0:
                print(f"  Error looping: {result.stderr}")
                return False

            print(f"  Saved {output_path.name}")

        # Clean up temp file
        if temp_trimmed.exists():
            temp_trimmed.unlink()

        return True

    except Exception as e:
        print(f"  Error: {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Trim and loop videos, optionally remove greenscreen and create sprite sheets with JSON metadata")
    parser.add_argument("input_folder", help="Input folder containing videos (e.g., character-animations/animated/batch_*)")
    parser.add_argument("--output", "-o", help="Output folder (default: character-animations/character-sprites)")
    parser.add_argument("--duration", "-d", type=float, default=3.5, help="Duration to trim to (default: 3.5)")
    parser.add_argument("--remove-greenscreen", "-g", action="store_true", help="Remove greenscreen background (for videos only, sprites always remove greenscreen)")
    parser.add_argument("--sprites", "-s", action="store_true", help="Output as sprite sheets (PNG + JSON metadata)")
    parser.add_argument("--fps", "-f", type=int, default=12, help="Frame rate for sprite extraction (default: 12)")
    parser.add_argument("--quality", "-q", type=int, default=75, help="Compression quality 0-100, higher=better (default: 75)")
    parser.add_argument("--test", "-t", action="store_true", help="Test mode: lower quality and fps for faster processing")
    parser.add_argument("--workers", "-w", type=int, default=None, help="Number of parallel workers (default: CPU count)")

    args = parser.parse_args()

    # Test mode overrides
    if args.test:
        args.fps = 6  # Lower fps for faster processing
        args.quality = 50  # Lower quality for faster processing
        print("⚡ TEST MODE: Using fps=6, quality=50 for faster processing\n")

    # Set worker count
    num_workers = args.workers if args.workers else multiprocessing.cpu_count()

    input_folder = Path(args.input_folder)

    if not input_folder.exists():
        print(f"Error: Folder '{input_folder}' not found")
        sys.exit(1)

    # Create output folder
    if args.output:
        output_folder = Path(args.output)
    else:
        if args.sprites:
            # Default for sprites: character-animations/character-sprites
            output_folder = Path("character-animations/character-sprites")
        else:
            # Default for looped videos: append -looped to input folder name
            output_folder = input_folder.parent / f"{input_folder.name}-looped"

    output_folder.mkdir(parents=True, exist_ok=True)

    # Get all video files recursively
    video_extensions = {'.mp4', '.mov', '.avi', '.mkv'}
    videos = list(input_folder.rglob('*'))
    videos = [f for f in videos if f.is_file() and f.suffix.lower() in video_extensions]

    if not videos:
        print(f"Error: No videos found in '{input_folder}'")
        sys.exit(1)

    print(f"Found {len(videos)} videos to process")
    print(f"Trimming to {args.duration} seconds")
    if args.sprites:
        print(f"Outputting as sprite sheets (PNG + JSON)")
        print(f"Frame rate: {args.fps} fps")
        print(f"Compression quality: {args.quality}/100")
        print("Greenscreen removal: Enabled (automatic for sprites)")
    else:
        print("Looping once")
        if args.remove_greenscreen:
            print("Removing greenscreen background")
    print(f"Output folder: {output_folder}")
    print(f"Workers: {num_workers}\n")

    # Prepare work items
    work_items = []
    for video in videos:
        if args.sprites:
            # Flatten structure for sprites: character-sprites/character_name/animation_sample.png
            # Extract character name from path
            relative_path = video.relative_to(input_folder)
            path_parts = relative_path.parts

            # Determine character name from path
            if len(path_parts) >= 3:
                # Full batch path: character_name/animation_type/video.mp4
                character_name = path_parts[0]
            elif len(path_parts) >= 2:
                # Single character folder: animation_type/video.mp4
                # Use input folder name as character name
                character_name = input_folder.name
            else:
                # Fallback: use video stem
                character_name = "unknown"

            video_filename = video.stem  # e.g., idle_sample1

            # Output: character-sprites/character_name/idle_sample1.png
            output_path = output_folder / character_name / video_filename
            output_path.parent.mkdir(parents=True, exist_ok=True)
        else:
            # Preserve folder structure for videos
            relative_path = video.relative_to(input_folder)
            output_path = output_folder / relative_path
            output_path.parent.mkdir(parents=True, exist_ok=True)

        work_items.append((video, output_path, args.duration, args.remove_greenscreen, args.sprites, args.fps, args.quality))

    # Process in parallel
    success_count = 0
    failed_count = 0

    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        # Submit all jobs
        futures = {executor.submit(trim_and_loop_video, *item): item[0] for item in work_items}

        # Process as they complete
        for future in as_completed(futures):
            video = futures[future]
            try:
                if future.result():
                    success_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                print(f"  Error processing {video.name}: {str(e)}")
                failed_count += 1

    print(f"\n{'='*60}")
    print(f"Complete! Processed {success_count}/{len(videos)} videos successfully")
    if failed_count > 0:
        print(f"Failed: {failed_count}")
    print(f"Output: {output_folder}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
