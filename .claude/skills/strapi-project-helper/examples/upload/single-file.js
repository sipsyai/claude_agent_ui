/**
 * SINGLE FILE UPLOAD EXAMPLES
 *
 * Bu dosya tek dosya yükleme örneklerini içerir
 */

// ============================================
// FRONTEND - REACT EXAMPLES
// ============================================

// Örnek 1: Basic file upload with React
import React, { useState } from 'react';
import axios from 'axios';

function FileUploader() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Only JPEG, PNG, and WebP images are allowed');
      return;
    }

    // Validate file size (5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('files', file);

    try {
      const response = await axios.post(
        'http://localhost:1337/api/upload',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setUploadedFile(response.data[0]);
      setFile(null);
      console.log('File uploaded:', response.data[0]);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} accept="image/*" />

      {file && (
        <div>
          <p>Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)</p>
          <button onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {uploadedFile && (
        <div>
          <h3>Upload successful!</h3>
          <img
            src={`http://localhost:1337${uploadedFile.url}`}
            alt={uploadedFile.name}
            style={{ maxWidth: '300px' }}
          />
        </div>
      )}
    </div>
  );
}

export default FileUploader;

// ============================================
// FRONTEND - WITH PROGRESS
// ============================================

// Örnek 2: Upload with progress bar
function FileUploaderWithProgress() {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append('files', file);

    try {
      const response = await axios.post(
        'http://localhost:1337/api/upload',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
          }
        }
      );

      console.log('Upload complete:', response.data[0]);
      setProgress(0);
      setFile(null);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload} disabled={uploading}>
        Upload
      </button>

      {uploading && (
        <div>
          <progress value={progress} max="100" />
          <span>{progress}%</span>
        </div>
      )}
    </div>
  );
}

// ============================================
// FRONTEND - ATTACH TO ENTRY
// ============================================

// Örnek 3: Upload and attach to article
async function uploadArticleCover(file, articleId) {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('ref', 'api::article.article');
  formData.append('refId', articleId);
  formData.append('field', 'coverImage');

  try {
    const response = await axios.post(
      'http://localhost:1337/api/upload',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );

    return response.data[0];
  } catch (err) {
    throw new Error('Upload failed: ' + err.message);
  }
}

// Usage:
async function createArticleWithCover() {
  const file = document.getElementById('coverInput').files[0];

  // 1. Create article first
  const articleResponse = await axios.post(
    'http://localhost:1337/api/articles',
    {
      data: {
        title: 'My Article',
        content: 'Article content...'
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const articleId = articleResponse.data.data.documentId;

  // 2. Upload cover image
  const uploadedFile = await uploadArticleCover(file, articleId);

  console.log('Article created with cover:', uploadedFile);
}

// ============================================
// BACKEND - CONTROLLER EXAMPLES
// ============================================

// Örnek 4: Custom upload endpoint
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async uploadCover(ctx) {
    const { id } = ctx.params;
    const { files } = ctx.request;

    // Validate
    if (!files || !files.cover) {
      return ctx.badRequest('Cover file is required');
    }

    const file = files.cover;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return ctx.badRequest('Invalid file type');
    }

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      return ctx.badRequest('File too large (max 5MB)');
    }

    try {
      // Upload file
      const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
        data: {
          refId: id,
          ref: 'api::article.article',
          field: 'coverImage'
        },
        files: file
      });

      return ctx.send({
        data: uploadedFiles[0],
        message: 'Cover uploaded successfully'
      });
    } catch (err) {
      strapi.log.error('Upload error:', err);
      return ctx.internalServerError('Upload failed');
    }
  }
}));

// ============================================
// BACKEND - SERVICE EXAMPLES
// ============================================

// Örnek 5: Upload from URL
async function uploadFromUrl(url, articleId) {
  const axios = require('axios');

  try {
    // Download file
    const response = await axios.get(url, {
      responseType: 'arraybuffer'
    });

    const buffer = Buffer.from(response.data);
    const fileName = url.split('/').pop();

    // Create file object
    const file = {
      name: fileName,
      type: response.headers['content-type'],
      size: buffer.length,
      buffer: buffer
    };

    // Upload to Strapi
    const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
      data: {
        refId: articleId,
        ref: 'api::article.article',
        field: 'coverImage'
      },
      files: file
    });

    return uploadedFiles[0];
  } catch (err) {
    throw new Error(`Failed to upload from URL: ${err.message}`);
  }
}

// Usage in controller:
async function importArticle(ctx) {
  const { title, content, coverImageUrl } = ctx.request.body;

  // Create article
  const article = await strapi.documents('api::article.article').create({
    data: { title, content }
  });

  // Upload cover from URL
  if (coverImageUrl) {
    await uploadFromUrl(coverImageUrl, article.documentId);
  }

  return ctx.send({ data: article });
}

// ============================================
// BACKEND - BASE64 UPLOAD
// ============================================

// Örnek 6: Upload from base64
async function uploadFromBase64(base64String, fileName, articleId) {
  try {
    // Decode base64
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Detect mime type
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,/);
    const mimeType = matches ? matches[1] : 'image/jpeg';

    // Create file object
    const file = {
      name: fileName,
      type: mimeType,
      size: buffer.length,
      buffer: buffer
    };

    // Upload
    const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
      data: {
        refId: articleId,
        ref: 'api::article.article',
        field: 'coverImage'
      },
      files: file
    });

    return uploadedFiles[0];
  } catch (err) {
    throw new Error(`Failed to upload from base64: ${err.message}`);
  }
}

// ============================================
// VANILLA JAVASCRIPT
// ============================================

// Örnek 7: Plain JavaScript upload
async function uploadFile() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  if (!file) {
    alert('Please select a file');
    return;
  }

  const formData = new FormData();
  formData.append('files', file);

  try {
    const response = await fetch('http://localhost:1337/api/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    console.log('Uploaded:', data[0]);

    // Display image
    const img = document.createElement('img');
    img.src = `http://localhost:1337${data[0].url}`;
    document.body.appendChild(img);
  } catch (err) {
    console.error('Error:', err);
    alert('Upload failed');
  }
}

// ============================================
// FILE PREVIEW
// ============================================

// Örnek 8: Image preview before upload
function previewImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      resolve(e.target.result);
    };

    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

// Usage in React:
function ImageUploaderWithPreview() {
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const previewUrl = await previewImage(selectedFile);
      setPreview(previewUrl);
    }
  };

  const handleUpload = async () => {
    // ... upload logic
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} accept="image/*" />

      {preview && (
        <div>
          <h3>Preview:</h3>
          <img src={preview} alt="Preview" style={{ maxWidth: '300px' }} />
        </div>
      )}

      {file && <button onClick={handleUpload}>Upload</button>}
    </div>
  );
}

// ============================================
// DRAG AND DROP
// ============================================

// Örnek 9: Drag and drop upload
function DragDropUploader() {
  const [dragging, setDragging] = useState(false);

  const handleDragEnter = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    // Upload file
    const formData = new FormData();
    formData.append('files', file);

    try {
      const response = await axios.post(
        'http://localhost:1337/api/upload',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      console.log('Uploaded:', response.data[0]);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        border: dragging ? '2px dashed blue' : '2px dashed gray',
        padding: '50px',
        textAlign: 'center'
      }}
    >
      <p>Drag and drop a file here</p>
    </div>
  );
}

module.exports = {
  uploadArticleCover,
  uploadFromUrl,
  uploadFromBase64,
  previewImage
};
