import replicate
import os
import json
import argparse
from pathlib import Path
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

# Load environment variables
load_dotenv()

def animate_image(image_path, animation_type, prompt, output_path, sample_num, use_last_frame=True, aspect_ratio="16:9"):
    """
    Animate a single image with Replicate Veo
    """
    try:
        print(f"[{animation_type}] Sample {sample_num} - Starting animation for {image_path.name}...")

        # Prepare input
        input_params = {
            "image": open(image_path, "rb"),
            "prompt": prompt,
            "duration": 4,
            "resolution": "1080p",
            "aspect_ratio": aspect_ratio,
            "generate_audio": False
        }

        # Add last_frame for all except death animation
        if use_last_frame:
            input_params["last_frame"] = open(image_path, "rb")

        # Run animation
        output = replicate.run(
            "google/veo-3.1-fast",
            input=input_params
        )

        # Save the output
        with open(output_path, "wb") as file:
            file.write(output.read())

        print(f"[{animation_type}] Sample {sample_num} - Saved {output_path}")
        return True

    except Exception as e:
        print(f"[{animation_type}] Sample {sample_num} - Error: {str(e)}")
        return False

def process_image(image_path, config, output_base, force=False):
    """
    Process a single image with all animations

    Args:
        force: If True, regenerate all animations. If False, skip existing files.
    """
    image_name = image_path.stem
    image_output_dir = Path(output_base) / image_name
    image_output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"Processing: {image_name}")
    print(f"{'='*60}")

    tasks = []
    skipped = 0

    # Create tasks for each animation type
    for anim_type, anim_config in config['animations'].items():
        prompt = anim_config['prompt']
        samples = anim_config.get('samples', 1)
        use_last_frame = anim_type != 'death'  # Death animation doesn't loop back

        for sample_num in range(1, samples + 1):
            # Create animation type folder
            anim_dir = image_output_dir / anim_type
            anim_dir.mkdir(exist_ok=True)

            # Output filename
            if samples > 1:
                output_filename = f"{anim_type}_sample{sample_num}.mp4"
            else:
                output_filename = f"{anim_type}.mp4"

            output_path = anim_dir / output_filename

            # Skip if file exists and not forcing regeneration
            if output_path.exists() and not force:
                print(f"  ✓ Skipping {anim_type} sample {sample_num} (already exists)")
                skipped += 1
                continue

            tasks.append({
                'image_path': image_path,
                'animation_type': anim_type,
                'prompt': prompt,
                'output_path': output_path,
                'sample_num': sample_num,
                'use_last_frame': use_last_frame,
                'aspect_ratio': config.get('aspect_ratio', '16:9')
            })

    if skipped > 0:
        print(f"  Skipped {skipped} existing animations")

    return tasks

def main():
    parser = argparse.ArgumentParser(description='Animate character images using Replicate Veo')
    parser.add_argument('input_path', type=str, help='Input image file or folder containing images')
    parser.add_argument('--config', type=str, help='JSON config file with animation settings')
    parser.add_argument('--output-folder', type=str, help='Output folder for animations (overrides config)')
    parser.add_argument('--animations', nargs='+', choices=['idle', 'attack', 'damage', 'death'],
                       help='Animation types to generate (space-separated)')
    parser.add_argument('--samples', type=int, default=2, help='Number of samples per animation (default: 2)')
    parser.add_argument('--threads', type=int, default=2, help='Number of concurrent threads (default: 2)')
    parser.add_argument('--aspect-ratio', type=str, default='16:9', help='Video aspect ratio (default: 16:9)')
    parser.add_argument('--force', action='store_true', help='Force regenerate all animations, even if they exist')
    parser.add_argument('--resume', type=str, help='Resume from existing batch folder (e.g., character-animations/animated/batch_20241024_134919)')

    args = parser.parse_args()

    input_path = Path(args.input_path)

    if not input_path.exists():
        print(f"Error: Input path '{input_path}' not found")
        return

    # Build config from command-line args or load from file
    if args.config:
        config_file = Path(args.config)
        if not config_file.exists():
            print(f"Error: Config file '{config_file}' not found")
            return
        with open(config_file, 'r') as f:
            config = json.load(f)

        # Override config values with command-line args if provided
        if args.output_folder:
            config['output_folder'] = args.output_folder
        if args.threads:
            config['max_concurrent'] = args.threads

        # Aspect ratio always comes from command-line args (not config)
        config['aspect_ratio'] = args.aspect_ratio
    else:
        # Build config from command-line arguments only
        if not args.animations:
            print("Error: Either --config or --animations must be specified")
            return

        # Default prompts for each animation type
        default_prompts = {
            'idle': 'Game animation: The character is idle, breathing gently and swaying slightly as if waiting.',
            'attack': 'Make this character perform an in game attack animation.',
            'damage': 'Make this character appear as if they are taking damage in game and in pain.',
            'death': 'Make this character perform an in game death animation.'
        }

        config = {
            'output_folder': args.output_folder or 'character-animations/animated',
            'max_concurrent': args.threads,
            'aspect_ratio': args.aspect_ratio,
            'animations': {
                anim_type: {
                    'prompt': default_prompts[anim_type],
                    'samples': args.samples
                }
                for anim_type in args.animations
            }
        }

    # Determine output base path
    if args.resume:
        # Resume from existing batch folder
        output_base = Path(args.resume)
        if not output_base.exists():
            print(f"Error: Resume folder '{output_base}' not found")
            return
        print(f"Resuming from existing batch: {output_base}")
    else:
        output_base = Path(config.get('output_folder', 'character-animations/animated'))

        # If processing a folder, add timestamp to avoid conflicts
        if input_path.is_dir():
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_base = output_base / f"batch_{timestamp}"

    output_base.mkdir(parents=True, exist_ok=True)

    print(f"Output folder: {output_base}")
    print(f"Aspect ratio from config: {config.get('aspect_ratio', 'NOT SET')}")

    # Get images to process
    image_extensions = {'.png', '.jpg', '.jpeg'}
    if input_path.is_file():
        if input_path.suffix.lower() in image_extensions:
            images = [input_path]
        else:
            print(f"Error: '{input_path}' is not a valid image file")
            return
    else:
        images = [f for f in input_path.iterdir() if f.suffix.lower() in image_extensions]
        if not images:
            print(f"Error: No images found in '{input_path}'")
            return

    print(f"Found {len(images)} image(s) to process")
    if args.force:
        print("Force mode: Will regenerate all animations\n")
    else:
        print("Resume mode: Will skip existing animations\n")

    # Collect all tasks
    all_tasks = []
    for img_path in images:
        tasks = process_image(img_path, config, output_base, force=args.force)
        all_tasks.extend(tasks)

    print(f"\n{'='*60}")
    if args.force:
        print(f"Total animations to generate: {len(all_tasks)}")
    else:
        print(f"Missing animations to generate: {len(all_tasks)}")
    print(f"{'='*60}\n")

    # If no tasks to process, exit early
    if len(all_tasks) == 0:
        print("✓ All animations already exist! Nothing to generate.")
        print("  Use --force to regenerate all animations.")
        return

    # Get concurrency settings from config
    max_workers = config.get('max_concurrent', 10)

    print(f"Running with {max_workers} concurrent workers...\n")

    # Process all tasks concurrently
    completed = 0
    failed = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_task = {
            executor.submit(
                animate_image,
                task['image_path'],
                task['animation_type'],
                task['prompt'],
                task['output_path'],
                task['sample_num'],
                task['use_last_frame'],
                task['aspect_ratio']
            ): task for task in all_tasks
        }

        # Process completed tasks
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

            print(f"\nProgress: {completed + failed}/{len(all_tasks)} ({completed} succeeded, {failed} failed)")

    print(f"\n{'='*60}")
    print(f"Batch processing complete!")
    print(f"Output folder: {output_base}")
    print(f"Total: {len(all_tasks)} | Completed: {completed} | Failed: {failed}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
