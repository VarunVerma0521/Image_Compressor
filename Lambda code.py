import json
import boto3
import os
from PIL import Image
import io
from urllib.parse import unquote_plus

s3_client = boto3.client('s3')

def lambda_handler(event, context):
    print(f"Full event: {json.dumps(event, indent=2)}")
    
    try:
        # Get the bucket and key from the S3 event
        record = event['Records'][0]
        bucket = record['s3']['bucket']['name']
        key = unquote_plus(record['s3']['object']['key'])
        
        print(f"Processing image from bucket: {bucket}")
        print(f"Processing image key: {key}")
        
        # EXPECTED INPUT KEY FORMAT (from API handler):
        #   uploads/<jobId>/original/<safe_file_name>
        parts = key.split('/')
        if len(parts) >= 4 and parts[0] == 'uploads':
            job_id = parts[1]              # <jobId>
            safe_file_name = parts[-1]     # <safe_file_name> e.g. Avatar_0f937fe6.png
        else:
            # Fallback (if someone uploads directly without the new pattern)
            # This will not match frontend expectations, but avoids crashing.
            print(f"WARNING: Unexpected key format: {key}")
            job_id = "default"
            safe_file_name = os.path.basename(key)
        
        print(f"Parsed job ID: {job_id}")
        print(f"Safe file name: {safe_file_name}")
        
        # Download image from S3
        try:
            response = s3_client.get_object(Bucket=bucket, Key=key)
            content_type = response.get('ContentType', 'image/jpeg')
            image_data = response['Body'].read()
            print(f"Successfully downloaded {len(image_data)} bytes")
        except Exception as e:
            print(f"Error downloading {key}: {e}")
            raise
        
        # Open image with Pillow
        image = Image.open(io.BytesIO(image_data))
        image.load()
        
        # Get original dimensions
        original_width, original_height = image.size
        print(f"Original dimensions: {original_width}x{original_height}")
        
        # Define output sizes
        output_sizes = {
            '1080p': (1920, 1080),
            '720p': (1280, 720),
            '480p': (854, 480)
        }
        
        # Get output bucket from environment
        output_bucket = os.environ.get('OUTPUT_BUCKET', 'output-bucket-image-compressor')
        print(f"Output bucket: {output_bucket}")
        
        processed_urls = {}
        
        for size_name, dimensions in output_sizes.items():
            print(f"Processing {size_name}...")
            
            # Resize image (maintain aspect ratio)
            resized_image = image.copy()
            resized_image.thumbnail(dimensions, Image.Resampling.LANCZOS)
            
            # Convert to RGB if necessary (for JPEG)
            if resized_image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', resized_image.size, (255, 255, 255))
                if resized_image.mode == 'RGBA':
                    background.paste(resized_image, mask=resized_image.split()[-1])
                else:
                    background.paste(resized_image)
                resized_image = background
            
            # Save to bytes
            output_buffer = io.BytesIO()
            # We always save as JPEG here; you can adjust if you want to keep PNG/WebP, etc.
            resized_image.save(output_buffer, format='JPEG', quality=85, optimize=True)
            output_buffer.seek(0)
            
            # IMPORTANT: Output key that matches frontend expectation:
            # processed/<jobId>/<size_name>/<safe_file_name>
            output_key = f"processed/{job_id}/{size_name}/{safe_file_name}"
            
            # Upload to output bucket
            s3_client.put_object(
                Bucket=output_bucket,
                Key=output_key,
                Body=output_buffer,
                ContentType='image/jpeg'
            )
            
            print(f"Uploaded to: {output_key}")
            
            # (Optional) Generate presigned URL - not used by frontend currently
            presigned_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': output_bucket,
                    'Key': output_key
                },
                ExpiresIn=3600
            )
            
            processed_urls[size_name] = {
                'url': presigned_url,
                'dimensions': dimensions,
                'size': len(output_buffer.getvalue()),
                'key': output_key
            }
        
        # Return results (mostly for logging; S3-triggered Lambdas ignore this)
        return {
            'statusCode': 200,
            'body': json.dumps({
                'jobId': job_id,
                'originalImage': key,
                'safeFileName': safe_file_name,
                'processedImages': processed_urls,
                'message': 'Image processing completed successfully'
            })
        }
        
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'event': event,
                'message': 'Image processing failed'
            })
        }
    