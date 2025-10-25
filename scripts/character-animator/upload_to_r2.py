#!/usr/bin/env python3
"""
Upload animations to Cloudflare R2
Usage: python upload_to_r2.py <local_folder> <monster_name>
Example: python upload_to_r2.py animations/doctor doctor
"""

import os
import sys
import boto3
from pathlib import Path
from dotenv import load_dotenv
from botocore.exceptions import ClientError

def upload_folder_to_r2(local_folder, monster_name, bucket_name="mystica-assets"):
    """
    Upload a local folder to R2 bucket at monsters/animations/<monster_name>

    Args:
        local_folder: Path to local folder (e.g., "animations/doctor")
        monster_name: Name of the monster (e.g., "doctor")
        bucket_name: R2 bucket name (default: "mystica-assets")
    """
    # Load environment variables
    load_dotenv()

    # Get R2 credentials from environment
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")

    if not all([account_id, access_key, secret_key]):
        print("Error: Missing R2 credentials in .env file")
        sys.exit(1)

    # Create S3 client for R2
    s3_client = boto3.client(
        's3',
        endpoint_url=f'https://{account_id}.r2.cloudflarestorage.com',
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name='auto'
    )

    local_path = Path(local_folder)

    if not local_path.exists():
        print(f"Error: Local folder '{local_folder}' not found")
        sys.exit(1)

    # Get all files to upload
    files_to_upload = []
    for file_path in local_path.rglob('*'):
        if file_path.is_file():
            files_to_upload.append(file_path)

    if not files_to_upload:
        print(f"Error: No files found in '{local_folder}'")
        sys.exit(1)

    print(f"Found {len(files_to_upload)} files to upload", flush=True)
    print(f"Uploading to: {bucket_name}/monsters/animations/{monster_name}\n", flush=True)

    uploaded = 0
    failed = 0
    total = len(files_to_upload)

    for idx, file_path in enumerate(files_to_upload, 1):
        # Calculate relative path from local folder
        relative_path = file_path.relative_to(local_path)

        # Construct R2 key: monsters/animations/{monster_name}/{relative_path}
        r2_key = f"monsters/animations/{monster_name}/{relative_path}"

        try:
            # Determine content type based on file extension
            content_type = 'image/png' if file_path.suffix.lower() == '.png' else 'application/octet-stream'

            # Upload file
            s3_client.upload_file(
                str(file_path),
                bucket_name,
                r2_key,
                ExtraArgs={'ContentType': content_type}
            )

            uploaded += 1
            print(f"[{idx}/{total}] ✓ {relative_path}", flush=True)

        except ClientError as e:
            failed += 1
            print(f"[{idx}/{total}] ✗ {relative_path} - {e}", flush=True)
        except Exception as e:
            failed += 1
            print(f"[{idx}/{total}] ✗ {relative_path} - {e}", flush=True)

    print(f"\n{'='*60}")
    print(f"Upload complete!")
    print(f"Uploaded: {uploaded}/{len(files_to_upload)} files")
    if failed > 0:
        print(f"Failed: {failed}")
    print(f"{'='*60}")

    # Print URL format for accessing files
    print(f"\nFiles can be accessed at:")
    print(f"https://pub-<your-r2-subdomain>.r2.dev/monsters/animations/{monster_name}/...")

def main():
    if len(sys.argv) != 3:
        print("Usage: python upload_to_r2.py <local_folder> <monster_name>")
        print("Example: python upload_to_r2.py animations/doctor doctor")
        sys.exit(1)

    local_folder = sys.argv[1]
    monster_name = sys.argv[2]

    upload_folder_to_r2(local_folder, monster_name)

if __name__ == "__main__":
    main()
