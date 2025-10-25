import os
import sys
import subprocess
import argparse
from pathlib import Path

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
        temp_trimmed = output_path.parent / f"temp_trimmed_{output_path.name}"

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
            # For sprite output, always remove greenscreen and create .atlas for Xcode
            print(f"  Extracting frames for sprite sheet ({fps} fps)...")

            # Create .atlas folder for Xcode (sprite atlas format)
            atlas_dir = output_path.parent / f"{output_path.stem}.atlas"
            atlas_dir.mkdir(exist_ok=True)

            frames_dir = output_path.parent / f"frames_{output_path.stem}"
            frames_dir.mkdir(exist_ok=True)

            # Extract frames with greenscreen removal (always enabled for sprites)
            extract_cmd = [
                'ffmpeg',
                '-i', str(temp_trimmed),
                '-vf', f'fps={fps},chromakey=0x00FF00:0.3:0.2',
                str(frames_dir / 'frame_%04d.png')
            ]

            result = subprocess.run(extract_cmd, capture_output=True, text=True)

            if result.returncode != 0:
                print(f"  Error extracting frames: {result.stderr}")
                return False

            # Optimize and compress frames, then move to .atlas folder
            print(f"  Optimizing and compressing frames...")
            from PIL import Image

            # Get all frame files
            frame_files = sorted(frames_dir.glob('frame_*.png'))

            if not frame_files:
                print(f"  Error: No frames extracted")
                return False

            num_frames = len(frame_files)

            # Process each frame: optimize and save to .atlas folder
            for idx, frame_file in enumerate(frame_files):
                frame = Image.open(frame_file)

                # Save optimized frame to .atlas folder
                # Use sequential naming for cleaner Xcode integration
                atlas_frame_path = atlas_dir / f"frame_{idx:04d}.png"

                # Apply compression and optimization
                # compress_level: 0-9 (9 = max compression, slower)
                # optimize: True = additional compression pass
                compress_level = int(9 - (compression_quality / 100) * 9)  # Convert quality to compression level
                frame.save(atlas_frame_path, 'PNG', compress_level=compress_level, optimize=True)
                frame.close()

            # Clean up temp frames directory
            import shutil
            shutil.rmtree(frames_dir)

            print(f"  Saved .atlas with {num_frames} optimized frames: {atlas_dir.name}")
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
    parser = argparse.ArgumentParser(description="Trim and loop videos, optionally remove greenscreen and create sprite atlases for Xcode")
    parser.add_argument("input_folder", help="Input folder containing videos")
    parser.add_argument("--output", "-o", help="Output folder name (default: input_folder-sprites or input_folder-looped)")
    parser.add_argument("--duration", "-d", type=float, default=3.5, help="Duration to trim to (default: 3.5)")
    parser.add_argument("--remove-greenscreen", "-g", action="store_true", help="Remove greenscreen background (for videos only, sprites always remove greenscreen)")
    parser.add_argument("--sprites", "-s", action="store_true", help="Output as .atlas sprite folders for Xcode")
    parser.add_argument("--fps", "-f", type=int, default=12, help="Frame rate for sprite extraction (default: 12)")
    parser.add_argument("--quality", "-q", type=int, default=75, help="Compression quality 0-100, higher=better (default: 75)")

    args = parser.parse_args()

    input_folder = Path(args.input_folder)

    if not input_folder.exists():
        print(f"Error: Folder '{input_folder}' not found")
        sys.exit(1)

    # Create output folder
    if args.output:
        output_folder = input_folder.parent / args.output
    else:
        suffix = "-sprites" if args.sprites else "-looped"
        output_folder = input_folder.parent / f"{input_folder.name}{suffix}"
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
        print(f"Outputting as .atlas sprite folders (Xcode format)")
        print(f"Frame rate: {args.fps} fps")
        print(f"Compression quality: {args.quality}/100")
        print("Greenscreen removal: Enabled (automatic for sprites)")
    else:
        print("Looping once")
        if args.remove_greenscreen:
            print("Removing greenscreen background")
    print(f"Output folder: {output_folder}\n")

    success_count = 0
    failed_count = 0

    for video in videos:
        # Preserve folder structure
        relative_path = video.relative_to(input_folder)
        output_path = output_folder / relative_path
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if trim_and_loop_video(video, output_path, args.duration, args.remove_greenscreen, args.sprites, args.fps, args.quality):
            success_count += 1
        else:
            failed_count += 1

    print(f"\n{'='*60}")
    print(f"Complete! Processed {success_count}/{len(videos)} videos successfully")
    if failed_count > 0:
        print(f"Failed: {failed_count}")
    print(f"Output: {output_folder}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
