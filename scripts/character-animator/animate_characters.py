import replicate
import os
import json
import sys
from pathlib import Path
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

# Load environment variables
load_dotenv()

def animate_image(image_path, animation_type, prompt, output_path, sample_num, use_last_frame=True, aspect_ratio="9:16"):
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

def process_image(image_path, config, output_base):
    """
    Process a single image with all animations
    """
    image_name = image_path.stem
    image_output_dir = Path(output_base) / image_name
    image_output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"Processing: {image_name}")
    print(f"{'='*60}")

    tasks = []

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

            tasks.append({
                'image_path': image_path,
                'animation_type': anim_type,
                'prompt': prompt,
                'output_path': output_path,
                'sample_num': sample_num,
                'use_last_frame': use_last_frame,
                'aspect_ratio': config.get('aspect_ratio', '9:16')
            })

    return tasks

def main():
    if len(sys.argv) < 3:
        print("Usage: python animate_characters.py <input_folder> <config.json>")
        sys.exit(1)

    input_folder = Path(sys.argv[1])
    config_file = Path(sys.argv[2])

    if not input_folder.exists():
        print(f"Error: Input folder '{input_folder}' not found")
        sys.exit(1)

    if not config_file.exists():
        print(f"Error: Config file '{config_file}' not found")
        sys.exit(1)

    # Load config
    with open(config_file, 'r') as f:
        config = json.load(f)

    # Create output folder with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_base = Path(config.get('output_folder', 'output')) / f"batch_{timestamp}"
    output_base.mkdir(parents=True, exist_ok=True)

    print(f"Output folder: {output_base}")

    # Get all images from input folder
    image_extensions = {'.png', '.jpg', '.jpeg'}
    images = [f for f in input_folder.iterdir() if f.suffix.lower() in image_extensions]

    if not images:
        print(f"Error: No images found in '{input_folder}'")
        sys.exit(1)

    print(f"Found {len(images)} images to process")

    # Collect all tasks
    all_tasks = []
    for image_path in images:
        tasks = process_image(image_path, config, output_base)
        all_tasks.extend(tasks)

    print(f"\n{'='*60}")
    print(f"Total animations to generate: {len(all_tasks)}")
    print(f"{'='*60}\n")

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
