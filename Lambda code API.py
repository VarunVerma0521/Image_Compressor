import json
import boto3
import os
import uuid

s3_client = boto3.client('s3')

def lambda_handler(event, context):
    print("=== Lambda Handler Started ===")
    print("Full Event:", json.dumps(event, indent=2))
    
    # Default response structure
    response = {
        'isBase64Encoded': False,
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
        },
        'body': ''
    }
    
    try:
        http_method = event.get('httpMethod', 'GET')
        print(f"HTTP Method: {http_method}")
        
        # ---------- CORS preflight ----------
        if http_method == 'OPTIONS':
            print("Handling CORS preflight request")
            return response
        
        # ---------- Parse JSON body (for POST) ----------
        request_body = {}
        if 'body' in event and event['body']:
            try:
                request_body = json.loads(event['body'])
                print(f"Parsed request body: {request_body}")
            except json.JSONDecodeError:
                print("Could not parse JSON body")
        
        # ---------- POST ----------
        if http_method == 'POST':
            action = request_body.get('action', '').lower()
            print(f"POST Action: {action}")
            
            # Simple health / connectivity test
            if action == 'test':
                response['body'] = json.dumps({
                    'message': 'API is working!',
                    'timestamp': context.aws_request_id,
                    'status': 'success'
                })
            
            # Main flow: issue presigned upload URL
            elif action == 'getpresigneduploadurl':
                original_file_name = request_body.get('fileName', 'image.jpg')
                file_type = request_body.get('fileType', 'image/jpeg')
                
                # Generate a short job id and unique safe file name
                job_id = str(uuid.uuid4())[:8]           # e.g. "4bb46700"
                base_name, ext = os.path.splitext(original_file_name)
                if not ext:
                    ext = '.jpg'
                unique_suffix = str(uuid.uuid4())[:8]
                safe_file_name = f"{base_name}_{unique_suffix}{ext}"  # e.g. Avatar_0f937fe6.png
                
                # Upload key in input bucket:
                # uploads/<job_id>/original/<safe_file_name>
                input_bucket = os.environ.get('INPUT_BUCKET', 'input-bucket-image-compressor')
                input_key = f"uploads/{job_id}/original/{safe_file_name}"
                
                print(f"JobId: {job_id}")
                print(f"Original file: {original_file_name}")
                print(f"Safe file name: {safe_file_name}")
                print(f"Input bucket: {input_bucket}")
                print(f"Input key: {input_key}")
                
                # Generate presigned POST for this key
                presigned_post = s3_client.generate_presigned_post(
                    Bucket=input_bucket,
                    Key=input_key,
                    Fields={
                        "Content-Type": file_type
                    },
                    Conditions=[
                        ["starts-with", "$Content-Type", "image/"],
                        ["content-length-range", 0, 10485760]  # 10MB
                    ],
                    ExpiresIn=3600
                )
                
                # This is where the optimizer Lambda will write its outputs:
                # processed/<job_id>/{1080p|720p|480p}/<safe_file_name>
                optimized_base_path = f"processed/{job_id}"
                
                response['body'] = json.dumps({
                    "uploadUrl": presigned_post["url"],
                    "fields": presigned_post["fields"],
                    "fileKey": input_key,                    # uploads/<job_id>/original/<safe_file_name>
                    "fileName": safe_file_name,             # Avatar_0f937fe6.png
                    "jobId": job_id,                        # 4bb46700
                    "optimizedBasePath": optimized_base_path,  # processed/4bb46700
                    "expiresIn": 3600,
                    "message": "Presigned URL generated successfully",
                    "status": "success"
                })
            
            else:
                response['statusCode'] = 400
                response['body'] = json.dumps({
                    'error': 'Invalid action for POST request',
                    'validActions': ['test', 'getPresignedUploadUrl'],
                    'received': action
                })
        
        # ---------- GET ----------
        elif http_method == 'GET':
            query_params = event.get('queryStringParameters', {}) or {}
            key = query_params.get('key', '')
            print(f"GET request with key: {key}")
            
            if not key:
                response['statusCode'] = 400
                response['body'] = json.dumps({
                    'error': 'Missing key parameter for GET request',
                    'example': 'Add ?key=processed/job_id/1080p/image.jpg to your URL',
                    'status': 'error'
                })
            else:
                output_bucket = os.environ.get('OUTPUT_BUCKET', 'output-bucket-image-compressor')
                print(f"Generating download URL for key: {key} from bucket: {output_bucket}")
                
                presigned_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': output_bucket, 'Key': key},
                    ExpiresIn=3600
                )
                
                response['body'] = json.dumps({
                    'url': presigned_url,
                    'key': key,
                    'expiresIn': 3600,
                    'message': 'Download URL generated',
                    'status': 'success'
                })
        
        # ---------- Unsupported methods ----------
        else:
            response['statusCode'] = 405
            response['body'] = json.dumps({
                'error': f'Method {http_method} not allowed',
                'allowedMethods': ['GET', 'POST', 'OPTIONS']
            })
            
    except Exception as e:
        print(f"Error in Lambda handler: {str(e)}")
        response['statusCode'] = 500
        response['body'] = json.dumps({
            'error': str(e),
            'message': 'Internal server error',
            'status': 'error'
        })
    
    print(f"Returning response: {response}")
    return response
