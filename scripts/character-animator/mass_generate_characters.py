import replicate
import csv
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

# Load environment variables
load_dotenv()

def generate_character(character_desc, reference_paths, output_path, aspect_ratio="9:16", output_format="jpg"):
    """
    Generate a single character using nano-banana
    """
    try:
        print(f"Generating: {character_desc[:50]}...")

        # Build the prompt
        prompt = f"Using the same style as the images attached, create a new full body character in idle position. The character is {character_desc}. The design of the character MUST be new, but in the same universe. Background should be white. You MUST use the style of the images attached. Copy the exactly look and feel."

        # Open reference images (each thread needs its own file handles)
        reference_images = [open(ref, "rb") for ref in reference_paths]

        # Prepare input
        input_params = {
            "prompt": prompt,
            "image_input": reference_images,
            "aspect_ratio": aspect_ratio,
            "output_format": output_format
        }

        # Run generation
        output = replicate.run(
            "google/nano-banana",
            input=input_params
        )

        # Save the output
        with open(output_path, "wb") as file:
            file.write(output.read())

        # Close reference images
        for ref in reference_images:
            ref.close()

        print(f"✓ Saved: {output_path.name}")
        return True

    except Exception as e:
        print(f"✗ Error generating '{character_desc[:30]}': {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Mass generate character images using nano-banana")
    parser.add_argument("csv_file", help="CSV file with character descriptions")
    parser.add_argument("--output", "-o", default="character-animations/generated", help="Output folder (default: character-animations/generated)")
    parser.add_argument("--references", "-r", nargs='+', required=True, help="Reference image paths")
    parser.add_argument("--aspect-ratio", default="9:16", help="Aspect ratio (default: 9:16)")
    parser.add_argument("--format", default="jpg", choices=["jpg", "png"], help="Output format")
    parser.add_argument("--concurrent", "-c", type=int, default=5, help="Max concurrent generations")

    args = parser.parse_args()

    csv_file = Path(args.csv_file)
    output_folder = Path(args.output)

    if not csv_file.exists():
        print(f"Error: CSV file '{csv_file}' not found")
        sys.exit(1)

    # Check reference images
    reference_paths = []
    for ref in args.references:
        ref_path = Path(ref)
        if not ref_path.exists():
            print(f"Error: Reference image '{ref}' not found")
            sys.exit(1)
        reference_paths.append(ref_path)

    print(f"Reference images: {len(reference_paths)}")
    for ref in reference_paths:
        print(f"  - {ref.name}")

    # Create output folder with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = output_folder / f"batch_{timestamp}"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Read CSV file
    characters = []
    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            characters.append(row)

    if not characters:
        print("Error: No characters found in CSV")
        sys.exit(1)

    print(f"\nFound {len(characters)} characters to generate")
    print(f"Output folder: {output_dir}")
    print(f"Aspect ratio: {args.aspect_ratio}")
    print(f"Max concurrent: {args.concurrent}\n")

    # Create tasks
    tasks = []
    for idx, char in enumerate(characters, 1):
        description = char.get('description', char.get('character_description', ''))
        filename = char.get('filename', f'character_{idx:03d}.{args.format}')

        if not filename.endswith(f'.{args.format}'):
            filename = f"{filename}.{args.format}"

        output_path = output_dir / filename

        tasks.append({
            'description': description,
            'reference_paths': reference_paths,
            'output_path': output_path,
            'aspect_ratio': args.aspect_ratio,
            'output_format': args.format
        })

    # Process tasks concurrently
    completed = 0
    failed = 0

    print("Starting generation...\n")

    with ThreadPoolExecutor(max_workers=args.concurrent) as executor:
        future_to_task = {
            executor.submit(
                generate_character,
                task['description'],
                task['reference_paths'],
                task['output_path'],
                task['aspect_ratio'],
                task['output_format']
            ): task for task in tasks
        }

        for future in as_completed(future_to_task):
            task = future_to_task[future]
            try:
                success = future.result()
                if success:
                    completed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"Task failed with exception: {e}")
                failed += 1

            print(f"Progress: {completed + failed}/{len(tasks)} ({completed} succeeded, {failed} failed)\n")

    print(f"\n{'='*60}")
    print(f"Generation complete!")
    print(f"Output folder: {output_dir}")
    print(f"Total: {len(tasks)} | Completed: {completed} | Failed: {failed}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
