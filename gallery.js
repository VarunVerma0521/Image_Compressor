// Gallery specific JavaScript
const GALLERY_API = 'https://your-api-id.execute-api.region.amazonaws.com/prod/images';

let allImages = [];
let filteredImages = [];
let currentFilter = 'all';
let currentSort = 'newest';

document.addEventListener('DOMContentLoaded', function() {
    loadGalleryImages();
    setupGalleryListeners();
});

function setupGalleryListeners() {
    // Filter tags
    document.querySelectorAll('.filter-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            filterImages();
        });
    });
    
    // Sort dropdown
    document.getElementById('sortSelect').addEventListener('change', function() {
        currentSort = this.value;
        sortImages();
    });
    
    // Search input
    document.getElementById('searchInput').addEventListener('input', function() {
        filterImages();
    });
    
    // Load more button
    document.getElementById('loadMore').addEventListener('click', loadMoreImages);
}

async function loadGalleryImages() {
    try {
        const response = await fetch(GALLERY_API);
        if (!response.ok) throw new Error('Failed to load gallery');
        
        allImages = await response.json();
        filteredImages = [...allImages];
        
        filterImages();
        sortImages();
        displayImages();
    } catch (error) {
        console.error('Error loading gallery:', error);
        document.getElementById('galleryGrid').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-2x"></i>
                <p>Unable to load gallery. Please try again later.</p>
            </div>
        `;
    }
}

function filterImages() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    filteredImages = allImages.filter(image => {
        // Apply search filter
        if (searchTerm && !image.name.toLowerCase().includes(searchTerm)) {
            return false;
        }
        
        // Apply tag filter
        switch(currentFilter) {
            case 'webp':
                return image.formats && image.formats.includes('webp');
            case 'watermark':
                return image.watermarked === true;
            case 'recent':
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return new Date(image.uploadedAt) > weekAgo;
            default:
                return true;
        }
    });
    
    sortImages();
    displayImages();
}

function sortImages() {
    filteredImages.sort((a, b) => {
        switch(currentSort) {
            case 'newest':
                return new Date(b.uploadedAt) - new Date(a.uploadedAt);
            case 'oldest':
                return new Date(a.uploadedAt) - new Date(b.uploadedAt);
            case 'name':
                return a.name.localeCompare(b.name);
            case 'size':
                return (b.originalSize || 0) - (a.originalSize || 0);
            default:
                return 0;
        }
    });
}

function displayImages() {
    const galleryGrid = document.getElementById('galleryGrid');
    
    if (filteredImages.length === 0) {
        galleryGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-images fa-2x"></i>
                <p>No images found. Try a different search or upload some images!</p>
            </div>
        `;
        return;
    }
    
    galleryGrid.innerHTML = filteredImages.map(image => `
        <div class="image-card" onclick="openImageModal('${image.id}')">
            <div class="image-preview">
                <img src="${image.thumbnailUrl || image.urls?.thumbnail || 'https://via.placeholder.com/300x180'}" 
                     alt="${image.name}"
                     loading="lazy">
            </div>
            <div class="image-info">
                <div class="image-name">${image.name}</div>
                <div class="image-meta">
                    <span class="meta-item">
                        <i class="fas fa-calendar"></i> ${formatDate(image.uploadedAt)}
                    </span>
                    <span class="meta-item">
                        <i class="fas fa-weight-hanging"></i> ${formatFileSize(image.originalSize)}
                    </span>
                </div>
                <div class="image-sizes">
                    ${image.sizes ? image.sizes.slice(0, 3).map(size => 
                        `<span class="size-badge">${size}</span>`
                    ).join('') : ''}
                    ${image.sizes && image.sizes.length > 3 ? 
                        `<span class="size-badge">+${image.sizes.length - 3} more</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function openImageModal(imageId) {
    const image = allImages.find(img => img.id === imageId);
    if (!image) return;
    
    document.getElementById('modalTitle').textContent = image.name;
    document.getElementById('modalImage').src = image.urls?.original || '';
    
    // Populate size options
    const sizeOptions = document.getElementById('sizeOptions');
    if (image.urls) {
        sizeOptions.innerHTML = Object.entries(image.urls).map(([size, url]) => `
            <div class="size-option ${size === 'original' ? 'active' : ''}" 
                 onclick="changeModalImage('${url}', '${size}')">
                <div class="size-label">${size.toUpperCase()}</div>
                <div class="size-url">${url.split('/').pop()}</div>
            </div>
        `).join('');
    }
    
    document.getElementById('imageModal').style.display = 'flex';
}

function changeModalImage(url, size) {
    document.getElementById('modalImage').src = url;
    document.querySelectorAll('.size-option').forEach(opt => opt.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

function closeModal() {
    document.getElementById('imageModal').style.display = 'none';
}

function downloadImage() {
    const imageUrl = document.getElementById('modalImage').src;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageUrl.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function copyImageLink() {
    const imageUrl = document.getElementById('modalImage').src;
    navigator.clipboard.writeText(imageUrl).then(() => {
        alert('Image URL copied to clipboard!');
    });
}

function loadMoreImages() {
    // Implement pagination if your API supports it
    alert('Load more functionality would be implemented with paginated API calls');
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('imageModal');
    if (event.target === modal) {
        closeModal();
    }
};