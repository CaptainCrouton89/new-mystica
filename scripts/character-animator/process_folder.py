import os
import sys
from pathlib import Path
import subprocess

def main():
    if len(sys.argv) < 3:
        print("Usage: python process_folder.py <input_folder> <output_folder> [--landscape]")
        sys.exit(1)

    input_folder = Path(sys.argv[1])
    output_folder = Path(sys.argv[2])
    landscape = "--landscape" in sys.argv

    if not input_folder.exists():
        print(f"Error: Input folder '{input_folder}' not found")
        sys.exit(1)

    # Create output folder
    output_folder.mkdir(parents=True, exist_ok=True)

    # Get all images
    image_extensions = {'.png', '.jpg', '.jpeg'}
    images = [f for f in input_folder.iterdir() if f.suffix.lower() in image_extensions and 'greenscreen' not in f.name and 'nobg' not in f.name]

    print(f"Found {len(images)} images to process")

    for img in images:
        print(f"\nProcessing {img.name}...")

        # Run process_image.py
        cmd = ["python", "process_image.py", str(img)]
        if landscape:
            cmd.append("--landscape")

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode == 0:
            print(result.stdout)

            # Move greenscreen file to output folder
            base_name = img.stem
            greenscreen_file = Path(f"{base_name}-greenscreen.png")
            if greenscreen_file.exists():
                dest = output_folder / greenscreen_file.name
                greenscreen_file.rename(dest)
                print(f"Moved to {dest}")

            # Remove nobg file
            nobg_file = Path(f"{base_name}-nobg.png")
            if nobg_file.exists():
                nobg_file.unlink()
        else:
            print(f"Error: {result.stderr}")

    print(f"\nDone! All images saved to {output_folder}")

if __name__ == "__main__":
    main()
