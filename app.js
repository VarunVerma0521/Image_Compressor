// Configuration - UPDATE THESE WITH YOUR VALUES
const config = {
    region: 'ap-south-1', 
    uploadsBucket: 'image.compressor.input.bucket',
    apiEndpoint: '' // We'll add this later when we create API Gateway
};

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const progressBar = document.getElementById('progressBar');
const statusDiv = document.getElementById('status');
const resultsDiv = document.getElementById('results');
const imageLinksDiv = document.getElementById('imageLinks');

// AWS SDK Configuration (will be loaded from CDN later)
let s3;

// Initialize AWS SDK
function initAWS() {
    // We'll configure this properly after Cognito setup
    AWS.config.region = config.region;
    
    // Temporary credentials for upload (we'll replace with Cognito later)
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: '' // We'll add this after Cognito setup
    });
    
    s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        params: { Bucket: config.uploadsBucket }
    });
}

// Upload image to S3
async function uploadImage() {
    const file = fileInput.files[0];
    if (!file) {
        showStatus('Please select an image file first.', 'error');
        return;
    }

    // Validate file type
    if (!file.type.match('image.*')) {
        showStatus('Please select an image file (JPEG, PNG, etc.)', 'error');
        return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showStatus('File size must be less than 10MB', 'error');
        return;
    }

    // Generate unique filename
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    
    // Show progress bar
    progressBar.style.display = 'block';
    progressBar.value = 0;
    
    try {
        // Upload to S3
        const params = {
            Key: `uploads/${fileName}`,
            Body: file,
            ContentType: file.type,
            ACL: 'private' // Private uploads
        };

        await s3.upload(params)
            .on('httpUploadProgress', (evt) => {
                const progress = Math.round((evt.loaded / evt.total) * 100);
                progressBar.value = progress;
            })
            .promise();

        showStatus('✅ Upload successful! Processing image...', 'success');
        
        // In Phase 3, we'll add API call to trigger processing
        // For now, just show success message
        setTimeout(() => {
            showStatus('Image processing started. Check back in a few moments!', 'success');
        }, 2000);

    } catch (error) {
        console.error('Upload error:', error);
        showStatus(`Upload failed: ${error.message}`, 'error');
    }
}

// Display status messages
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status-${type}`;
    statusDiv.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Display processed image links (will be populated from API later)
function displayProcessedImages(imageData) {
    resultsDiv.style.display = 'block';
    imageLinksDiv.innerHTML = '';
    
    Object.entries(imageData).forEach(([size, url]) => {
        const div = document.createElement('div');
        div.style.margin = '10px 0';
        div.innerHTML = `
            <strong>${size}:</strong>
            <a href="${url}" target="_blank">${url}</a>
            <br>
            <img src="${url}" style="max-width: 200px; margin-top: 5px; border: 1px solid #ddd;">
        `;
        imageLinksDiv.appendChild(div);
    });
}

// Cognito functions (to be implemented in Phase 4)
function login() {
    showStatus('Cognito login will be implemented in Phase 4', 'success');
}

function logout() {
    showStatus('Logout will be implemented in Phase 4', 'success');
}

// Initialize when page loads
window.onload = function() {
    initAWS();
    // For now, allow uploads without authentication
    // We'll add Cognito auth in Phase 4
};