// Configuration - Replace with your actual API endpoints
const API_BASE_URL = 'https://your-api-id.execute-api.region.amazonaws.com/prod';
const UPLOAD_API = `${API_BASE_URL}/upload-url`;
const GALLERY_API = `${API_BASE_URL}/images`;

// State management
let selectedFiles = [];
let uploadProgress = {};

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const filePreview = document.getElementById('filePreview');
const uploadBtn = document.getElementById('uploadBtn');
const clearBtn = document.getElementById('clearBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');
const progressStatus = document.getElementById('progressStatus');
const recentUploads = document.getElementById('recentUploads');
const qualitySlider = document.getElementById('quality');
const qualityValue = document.getElementById('qualityValue');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadRecentUploads();
    setupEventListeners();
});

function setupEventListeners() {
    // Drag and drop
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    
    // File input change
    fileInput.addEventListener('change', handleFileSelect);
    
    // Upload button
    uploadBtn.addEventListener('click', startUpload);
    
    // Clear button
    clearBtn.addEventListener('click', clearAllFiles);
    
    // Quality slider
    qualitySlider.addEventListener('input', function() {
        qualityValue.textContent = this.value;
    });
}

// Drag and Drop Handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files);
    addFilesToSelection(files);
}

// File Selection
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFilesToSelection(files);
}

function addFilesToSelection(files) {
    const validFiles = files.filter(file => {
        // Validate file type and size (10MB max)
        const isValidType = file.type.startsWith('image/');
        const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
        
        if (!isValidType) {
            alert(`"${file.name}" is not a valid image file.`);
            return false;
        }
        
        if (!isValidSize) {
            alert(`"${file.name}" exceeds 10MB limit.`);
            return false;
        }
        
        return true;
    });
    
    selectedFiles = [...selectedFiles, ...validFiles];
    updateFileList();
    updateUploadButton();
}

function updateFileList() {
    if (selectedFiles.length === 0) {
        filePreview.style.display = 'none';
        return;
    }
    
    filePreview.style.display = 'block';
    fileList.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-icon">
                <i class="fas fa-file-image"></i>
            </div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="file-remove" onclick="removeFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        fileList.appendChild(fileItem);
    });
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
    updateUploadButton();
}

function clearAllFiles() {
    selectedFiles = [];
    fileInput.value = '';
    updateFileList();
    updateUploadButton();
}

function updateUploadButton() {
    uploadBtn.disabled = selectedFiles.length === 0;
}

// Upload Process
async function startUpload() {
    if (selectedFiles.length === 0) return;
    
    showProgress();
    uploadProgress = {
        total: selectedFiles.length,
        completed: 0,
        currentFile: ''
    };
    
    // Get processing options
    const options = {
        convertToWebP: document.getElementById('webp').checked,
        addWatermark: document.getElementById('watermark').checked,
        quality: parseInt(qualitySlider.value)
    };
    
    // Upload each file sequentially
    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        uploadProgress.currentFile = file.name;
        updateProgress();
        
        try {
            await uploadSingleFile(file, options);
            uploadProgress.completed++;
            updateProgress();
        } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            alert(`Failed to upload "${file.name}". Please try again.`);
            // Continue with other files
        }
    }
    
    // Complete
    progressStatus.innerHTML = `
        <i class="fas fa-check-circle" style="color: var(--secondary)"></i>
        All files processed! Redirecting to gallery...
    `;
    
    // Clear files and reload recent uploads
    setTimeout(() => {
        clearAllFiles();
        hideProgress();
        loadRecentUploads();
        // Optionally redirect to gallery
        // window.location.href = 'gallery.html';
    }, 2000);
}

async function uploadSingleFile(file, options) {
    // Step 1: Get pre-signed URL from our API
    progressStatus.textContent = `Getting upload URL for ${file.name}...`;
    
    const response = await fetch(UPLOAD_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            options: options
        })
    });
    
    if (!response.ok) {
        throw new Error('Failed to get upload URL');
    }
    
    const { uploadUrl, key } = await response.json();
    
    // Step 2: Upload directly to S3 using the pre-signed URL
    progressStatus.textContent = `Uploading ${file.name} to S3...`;
    
    await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
            'Content-Type': file.type
        }
    });
    
    progressStatus.textContent = `${file.name} uploaded! Processing started...`;
    
    // Note: The S3 trigger will automatically invoke our Lambda for processing
    // We don't need to wait for processing to complete here
}

// Progress UI
function showProgress() {
    progressContainer.style.display = 'block';
    uploadBtn.disabled = true;
    clearBtn.disabled = true;
}

function hideProgress() {
    progressContainer.style.display = 'none';
    uploadBtn.disabled = false;
    clearBtn.disabled = false;
}

function updateProgress() {
    const percent = Math.round((uploadProgress.completed / uploadProgress.total) * 100);
    progressFill.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    
    progressStatus.textContent = 
        `Processing ${uploadProgress.currentFile} (${uploadProgress.completed + 1}/${uploadProgress.total})`;
}

// Gallery Functions
async function loadRecentUploads() {
    try {
        const response = await fetch(GALLERY_API);
        if (!response.ok) throw new Error('Failed to load images');
        
        const images = await response.json();
        displayRecentUploads(images);
    } catch (error) {
        console.error('Error loading recent uploads:', error);
        recentUploads.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-2x"></i>
                <p>Unable to load images. API may not be ready yet.</p>
            </div>
        `;
    }
}

function displayRecentUploads(images) {
    if (!images || images.length === 0) {
        recentUploads.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-images fa-2x"></i>
                <p>No images processed yet. Upload some to get started!</p>
            </div>
        `;
        return;
    }
    
    recentUploads.innerHTML = images.slice(0, 6).map(image => `
        <div class="image-card">
            <div class="image-preview">
                <img src="${image.thumbnailUrl || 'https://via.placeholder.com/300x180?text=Processing...'}" 
                     alt="${image.name}">
            </div>
            <div class="image-info">
                <div class="image-name">${image.name}</div>
                <div class="image-sizes">
                    ${image.sizes ? image.sizes.map(size => 
                        `<span class="size-badge">${size}</span>`
                    ).join('') : ''}
                </div>
                <div style="margin-top: 10px;">
                    <a href="gallery.html?image=${image.id}" class="btn-secondary" style="padding: 5px 10px; font-size: 0.9rem;">
                        <i class="fas fa-external-link-alt"></i> View All Sizes
                    </a>
                </div>
            </div>
        </div>
    `).join('');
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}