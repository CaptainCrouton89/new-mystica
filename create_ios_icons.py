#!/usr/bin/env python3
"""
iOS App Icon Generator
Creates all required iOS app icon sizes from a source image.
"""

import os
import sys
from PIL import Image, ImageFilter
import argparse

# iOS App Icon sizes (in points, @1x, @2x, @3x)
ICON_SIZES = [
    # iPhone
    {"size": 20, "scale": 1, "filename": "Icon-App-20x20@1x.png"},
    {"size": 20, "scale": 2, "filename": "Icon-App-20x20@2x.png"},
    {"size": 20, "scale": 3, "filename": "Icon-App-20x20@3x.png"},
    {"size": 29, "scale": 1, "filename": "Icon-App-29x29@1x.png"},
    {"size": 29, "scale": 2, "filename": "Icon-App-29x29@2x.png"},
    {"size": 29, "scale": 3, "filename": "Icon-App-29x29@3x.png"},
    {"size": 40, "scale": 1, "filename": "Icon-App-40x40@1x.png"},
    {"size": 40, "scale": 2, "filename": "Icon-App-40x40@2x.png"},
    {"size": 40, "scale": 3, "filename": "Icon-App-40x40@3x.png"},
    {"size": 60, "scale": 2, "filename": "Icon-App-60x60@2x.png"},
    {"size": 60, "scale": 3, "filename": "Icon-App-60x60@3x.png"},
    # iPad
    {"size": 20, "scale": 1, "filename": "Icon-App-20x20@1x-ipad.png"},
    {"size": 20, "scale": 2, "filename": "Icon-App-20x20@2x-ipad.png"},
    {"size": 29, "scale": 1, "filename": "Icon-App-29x29@1x-ipad.png"},
    {"size": 29, "scale": 2, "filename": "Icon-App-29x29@2x-ipad.png"},
    {"size": 40, "scale": 1, "filename": "Icon-App-40x40@1x-ipad.png"},
    {"size": 40, "scale": 2, "filename": "Icon-App-40x40@2x-ipad.png"},
    {"size": 76, "scale": 1, "filename": "Icon-App-76x76@1x-ipad.png"},
    {"size": 76, "scale": 2, "filename": "Icon-App-76x76@2x-ipad.png"},
    {"size": 83.5, "scale": 2, "filename": "Icon-App-83.5x83.5@2x-ipad.png"},
    # App Store
    {"size": 1024, "scale": 1, "filename": "Icon-App-1024x1024@1x.png"},
]


def create_icon_from_source(source_path, output_dir, size_info):
    """Create a single icon from the source image."""
    try:
        # Open source image
        source = Image.open(source_path)

        # Calculate actual pixel size
        pixel_size = int(size_info["size"] * size_info["scale"])

        # Convert to RGB if necessary (for PNG output)
        if source.mode != "RGB":
            source = source.convert("RGB")

        # Resize with high quality
        resized = source.resize((pixel_size, pixel_size), Image.Resampling.LANCZOS)

        # Apply slight sharpening for small sizes
        if pixel_size < 60:
            resized = resized.filter(
                ImageFilter.UnsharpMask(radius=1, percent=150, threshold=3)
            )

        # Save the icon
        output_path = os.path.join(output_dir, size_info["filename"])
        resized.save(output_path, "PNG", optimize=True)

        print(f"Created: {size_info['filename']} ({pixel_size}x{pixel_size})")
        return True

    except Exception as e:
        print(f"Error creating {size_info['filename']}: {e}")
        return False


def update_contents_json(icon_dir):
    """Update the Contents.json file with all icon references."""
    contents = {"images": [], "info": {"author": "xcode", "version": 1}}

    # Add all icon sizes to Contents.json
    for size_info in ICON_SIZES:
        image_entry = {
            "filename": size_info["filename"],
            "idiom": "universal",
            "platform": "ios",
            "size": f"{size_info['size']}x{size_info['size']}",
        }

        if size_info["scale"] != 1:
            image_entry["scale"] = f"{size_info['scale']}x"

        contents["images"].append(image_entry)

    # Write Contents.json
    import json

    contents_path = os.path.join(icon_dir, "Contents.json")
    with open(contents_path, "w") as f:
        json.dump(contents, f, indent=2)

    print(f"Updated: {contents_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate iOS app icons from a source image"
    )
    parser.add_argument(
        "source_image", help="Path to the source image (PNG, JPG, etc.)"
    )
    parser.add_argument(
        "--output-dir",
        default="AppIcon.appiconset",
        help="Output directory for icons (default: AppIcon.appiconset)",
    )

    args = parser.parse_args()

    # Check if source image exists
    if not os.path.exists(args.source_image):
        print(f"Error: Source image '{args.source_image}' not found")
        sys.exit(1)

    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)

    # Generate all icons
    success_count = 0
    total_count = len(ICON_SIZES)

    for size_info in ICON_SIZES:
        if create_icon_from_source(args.source_image, args.output_dir, size_info):
            success_count += 1

    # Update Contents.json
    update_contents_json(args.output_dir)

    print(f"\nCompleted: {success_count}/{total_count} icons created successfully")

    if success_count == total_count:
        print("✅ All icons generated successfully!")
        print(f"Icons saved to: {os.path.abspath(args.output_dir)}")
    else:
        print("⚠️  Some icons failed to generate. Check the errors above.")


if __name__ == "__main__":
    main()
