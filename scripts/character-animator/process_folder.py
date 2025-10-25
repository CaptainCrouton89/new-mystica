import os
import sys
from pathlib import Path
import subprocess
import argparse

def main():
    parser = argparse.ArgumentParser(description="Process images: remove background and add greenscreen")
    parser.add_argument("input_folder", help="Input folder containing images")
    parser.add_argument("--output", "-o", default="character-animations/processed",
                       help="Output folder (default: character-animations/processed)")
    parser.add_argument("--landscape", action="store_true",
                       help="Use 16:9 aspect ratio (default is 9:16)")
    parser.add_argument("--limit", type=int,
                       help="Limit number of images to process")

    args = parser.parse_args()

    input_folder = Path(args.input_folder)
    output_folder = Path(args.output)

    if not input_folder.exists():
        print(f"Error: Input folder '{input_folder}' not found")
        sys.exit(1)

    # Create output folder
    output_folder.mkdir(parents=True, exist_ok=True)

    # Get all images
    image_extensions = {'.png', '.jpg', '.jpeg'}
    images = [f for f in input_folder.iterdir()
             if f.suffix.lower() in image_extensions
             and 'greenscreen' not in f.name
             and 'nobg' not in f.name]

    # Limit if specified
    if args.limit:
        images = images[:args.limit]

    print(f"Found {len(images)} images to process")
    print(f"Output folder: {output_folder}")
    print(f"Aspect ratio: {'16:9 (landscape)' if args.landscape else '9:16 (portrait)'}\n")

    success_count = 0
    failed_count = 0

    for idx, img in enumerate(images, 1):
        print(f"[{idx}/{len(images)}] Processing {img.name}...")

        # Run process_image.py
        cmd = ["python", "process_image.py", str(img)]
        if args.landscape:
            cmd.append("--landscape")

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode == 0:
            print(result.stdout.strip())

            # Move greenscreen file to output folder (it's in the same dir as input)
            base_name = img.stem
            greenscreen_file = img.parent / f"{base_name}-greenscreen.png"
            if greenscreen_file.exists():
                dest = output_folder / greenscreen_file.name
                greenscreen_file.rename(dest)
                print(f"✓ Saved to {dest}\n")
                success_count += 1
            else:
                print(f"✗ Greenscreen file not found at {greenscreen_file}\n")
                failed_count += 1

            # Clean up nobg file
            nobg_file = img.parent / f"{base_name}-nobg.png"
            if nobg_file.exists():
                nobg_file.unlink()
        else:
            print(f"✗ Error: {result.stderr}\n")
            failed_count += 1

    print("="*60)
    print(f"Processing complete!")
    print(f"Output folder: {output_folder}")
    print(f"Total: {len(images)} | Success: {success_count} | Failed: {failed_count}")
    print("="*60)

if __name__ == "__main__":
    main()
