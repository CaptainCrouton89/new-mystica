#!/usr/bin/env python3
"""
Generate placeholder icons for iOS App Icon Set
This creates simple colored squares as placeholders until you replace them with your actual icon.
"""

import os
from PIL import Image, ImageDraw

# Icon sizes and filenames
ICONS = [
    # iPhone icons
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
    # iPad icons
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


def create_placeholder_icon(size_info, output_dir):
    """Create a placeholder icon with the Mystica gradient colors."""
    pixel_size = int(size_info["size"] * size_info["scale"])

    # Create gradient from magenta to cyan (matching your description)
    image = Image.new("RGB", (pixel_size, pixel_size))
    draw = ImageDraw.Draw(image)

    # Create gradient by drawing horizontal lines
    for y in range(pixel_size):
        # Interpolate from magenta (255, 0, 255) to cyan (0, 255, 255)
        ratio = y / pixel_size
        r = int(255 * (1 - ratio))
        g = int(255 * ratio)
        b = 255
        draw.line([(0, y), (pixel_size, y)], fill=(r, g, b))

    # Add a simple "M" in the center
    draw.rectangle(
        [pixel_size // 4, pixel_size // 4, 3 * pixel_size // 4, 3 * pixel_size // 4],
        outline=(0, 0, 0),
        width=max(1, pixel_size // 50),
    )

    # Save the placeholder
    output_path = os.path.join(output_dir, size_info["filename"])
    image.save(output_path, "PNG")
    print(f"Created placeholder: {size_info['filename']} ({pixel_size}x{pixel_size})")


def main():
    icon_dir = "/Users/SpartanPip/Desktop/new-mystica/New-Mystica/New-Mystica/Assets.xcassets/AppIcon.appiconset"

    print("Creating placeholder icons...")
    for icon_info in ICONS:
        create_placeholder_icon(icon_info, icon_dir)

    print(f"\n✅ Created {len(ICONS)} placeholder icons in:")
    print(f"   {icon_dir}")
    print(
        "\n⚠️  These are placeholders! Replace them with your actual icon using the script."
    )


if __name__ == "__main__":
    main()
