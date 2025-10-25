import replicate
from PIL import Image
import sys
import os
import argparse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def process_image(input_file, landscape=False):
    """
    Process an image: remove background, then place on greenscreen canvas
    Default: 9:16 (1080x1920) - vertical
    With --landscape: 16:9 (1920x1080) - horizontal
    """
    # Get base filename without extension
    base_name = os.path.splitext(input_file)[0]

    # Step 1: Remove background using Replicate
    print(f"Removing background from {input_file}...")
    output = replicate.run(
        "bria/remove-background",
        input={
            "image": open(input_file, "rb"),
            "content_moderation": False,
            "preserve_partial_alpha": True
        }
    )

    # Save transparent version
    nobg_file = f"{base_name}-nobg.png"
    with open(nobg_file, "wb") as file:
        file.write(output.read())
    print(f"Saved {nobg_file}")

    # Step 2: Add greenscreen background
    skeleton = Image.open(nobg_file)

    # Determine target dimensions based on aspect ratio
    img_width, img_height = skeleton.size
    is_landscape = img_width > img_height

    # Override with flag if provided
    if landscape:
        is_landscape = True

    # Set target dimensions
    if is_landscape:
        target_width, target_height = 1280, 720
        aspect = "16:9"
    else:
        target_width, target_height = 720, 1280
        aspect = "9:16"

    print(f"Resizing to {aspect} ({target_width}x{target_height}) with greenscreen...")

    # Resize image to fit within target dimensions while maintaining aspect ratio
    skeleton.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)

    # Create canvas with chroma key green
    greenscreen = Image.new('RGB', (target_width, target_height), (0, 255, 0))

    # Center the image on canvas
    skeleton_width, skeleton_height = skeleton.size
    x = (target_width - skeleton_width) // 2
    y = (target_height - skeleton_height) // 2

    # Paste the image
    greenscreen.paste(skeleton, (x, y), skeleton)

    # Save final result
    final_file = f"{base_name}-greenscreen.png"
    greenscreen.save(final_file)
    print(f"Saved {final_file}")
    print("Done!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Remove background and add greenscreen")
    parser.add_argument("input_file", help="Input image file")
    parser.add_argument("--landscape", action="store_true", help="Use 16:9 aspect ratio (default is 9:16)")

    args = parser.parse_args()

    if not os.path.exists(args.input_file):
        print(f"Error: File '{args.input_file}' not found")
        sys.exit(1)

    process_image(args.input_file, landscape=args.landscape)
