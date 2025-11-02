# Upload API - Dosya Yükleme

## Dosya Yükleme Yöntemleri

Strapi'de 3 farklı şekilde dosya yükleyebilirsiniz:

1. **Admin Panel** - Manuel upload
2. **REST API** - Form-data ile HTTP request
3. **Programmatic** - Backend'de kod ile

## REST API ile Dosya Yükleme

### 1. Basit Dosya Yükleme

```javascript
// Frontend - Axios ile
const formData = new FormData();
formData.append('files', fileInput.files[0]);

const response = await axios.post('http://localhost:1337/api/upload', formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
    'Authorization': `Bearer ${token}`
  }
});

console.log(response.data); // Uploaded file info
```

```javascript
// Frontend - Fetch API ile
const formData = new FormData();
formData.append('files', fileInput.files[0]);

const response = await fetch('http://localhost:1337/api/upload', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
```

### 2. Çoklu Dosya Yükleme

```javascript
const formData = new FormData();

// Birden fazla dosya ekle
for (let i = 0; i < fileInput.files.length; i++) {
  formData.append('files', fileInput.files[i]);
}

const response = await axios.post('http://localhost:1337/api/upload', formData, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### 3. Entry'ye Bağlı Dosya Yükleme

Dosyayı doğrudan bir Content Type entry'sine bağlayabilirsiniz:

```javascript
const formData = new FormData();
formData.append('files', fileInput.files[0]);
formData.append('ref', 'api::article.article');  // Content Type
formData.append('refId', articleId);             // Entry ID
formData.append('field', 'coverImage');          // Field name

const response = await axios.post('http://localhost:1337/api/upload', formData);
```

### 4. Entry Oluştururken Dosya Yükleme

Yeni entry oluştururken dosya da yükleyebilirsiniz:

```javascript
const formData = new FormData();

// Article data
formData.append('data', JSON.stringify({
  title: 'My Article',
  content: 'Article content...',
  publishedAt: new Date()
}));

// Cover image
formData.append('files.coverImage', fileInput.files[0]);

const response = await axios.post('http://localhost:1337/api/articles', formData, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Backend'de Programmatic Upload

### 1. Upload Service Kullanımı

```javascript
// Controller veya Service içinde
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async uploadCover(ctx) {
    const { id } = ctx.params;
    const { files } = ctx.request;

    if (!files || !files.cover) {
      return ctx.badRequest('Cover file is required');
    }

    try {
      // Upload file
      const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
        data: {
          refId: id,
          ref: 'api::article.article',
          field: 'coverImage'
        },
        files: files.cover
      });

      // Update article
      const article = await strapi.documents('api::article.article').update({
        documentId: id,
        data: {
          coverImage: uploadedFiles[0].id
        }
      });

      return ctx.send({
        data: article,
        message: 'Cover uploaded successfully'
      });
    } catch (err) {
      return ctx.internalServerError('Upload failed', { error: err.message });
    }
  }
}));
```

### 2. URL'den Dosya İndirip Yükleme

```javascript
const axios = require('axios');
const FormData = require('form-data');

async function uploadFromUrl(url, articleId) {
  try {
    // Download file
    const response = await axios.get(url, {
      responseType: 'arraybuffer'
    });

    const buffer = Buffer.from(response.data);

    // Create file object
    const fileName = url.split('/').pop();
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
```

### 3. Base64'ten Dosya Yükleme

```javascript
async function uploadFromBase64(base64String, fileName, articleId) {
  try {
    // Base64 decode
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Detect file type
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
```

## Dosya İşlemleri

### 1. Dosya Bilgilerini Getirme

```javascript
// Tek dosya
const file = await strapi.plugins.upload.services.upload.findOne(fileId);

// Tüm dosyalar
const files = await strapi.plugins.upload.services.upload.findMany({
  filters: {
    name: { $containsi: 'logo' }
  }
});
```

### 2. Dosya Güncelleme

```javascript
const updatedFile = await strapi.plugins.upload.services.upload.update(fileId, {
  name: 'new-name.jpg',
  alternativeText: 'New alt text',
  caption: 'New caption'
});
```

### 3. Dosya Silme

```javascript
// Controller'da
async deleteFile(ctx) {
  const { id } = ctx.params;

  try {
    await strapi.plugins.upload.services.upload.remove({ id });

    return ctx.send({
      message: 'File deleted successfully'
    });
  } catch (err) {
    return ctx.internalServerError('Delete failed');
  }
}
```

### 4. Dosya Replace (Değiştirme)

```javascript
async replaceCover(ctx) {
  const { id } = ctx.params;  // Article ID
  const { files } = ctx.request;

  try {
    // Mevcut article'ı getir
    const article = await strapi.documents('api::article.article').findOne({
      documentId: id,
      populate: ['coverImage']
    });

    // Eski dosyayı sil
    if (article.coverImage) {
      await strapi.plugins.upload.services.upload.remove({
        id: article.coverImage.id
      });
    }

    // Yeni dosyayı yükle
    const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
      data: {
        refId: id,
        ref: 'api::article.article',
        field: 'coverImage'
      },
      files: files.cover
    });

    return ctx.send({
      data: uploadedFiles[0]
    });
  } catch (err) {
    return ctx.internalServerError('Replace failed');
  }
}
```

## File Validation

### 1. File Size Validation

```javascript
// Middleware
module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const { files } = ctx.request;

    if (files) {
      const maxSize = 5 * 1024 * 1024; // 5MB

      for (const file of Object.values(files)) {
        if (file.size > maxSize) {
          return ctx.badRequest('File size exceeds 5MB limit');
        }
      }
    }

    await next();
  };
};
```

### 2. File Type Validation

```javascript
// Middleware
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const { files } = ctx.request;

    if (files) {
      for (const file of Object.values(files)) {
        if (!allowedTypes.includes(file.type)) {
          return ctx.badRequest('Invalid file type. Only JPEG, PNG, and WebP allowed.');
        }
      }
    }

    await next();
  };
};
```

### 3. File Name Sanitization

```javascript
function sanitizeFileName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Upload'tan önce kullan
file.name = sanitizeFileName(file.name);
```

## Upload Lifecycle Hooks

```javascript
// src/extensions/upload/strapi-server.js
module.exports = (plugin) => {
  // Before upload
  plugin.controllers.upload.upload = async (ctx) => {
    const { files } = ctx.request;

    // Custom validation
    if (files) {
      for (const file of Object.values(files)) {
        // Validate
        if (file.size > 10 * 1024 * 1024) {
          return ctx.badRequest('File too large');
        }

        // Transform filename
        file.name = sanitizeFileName(file.name);
      }
    }

    // Call original upload
    return plugin.controllers.upload.upload(ctx);
  };

  // After upload
  const originalUpload = plugin.services.upload.upload;
  plugin.services.upload.upload = async (args) => {
    const result = await originalUpload(args);

    // Post-upload processing
    strapi.log.info(`File uploaded: ${result[0].name}`);

    // Trigger webhook, notification, etc.

    return result;
  };

  return plugin;
};
```

## Response Format

### Successful Upload Response

```json
{
  "id": 1,
  "name": "image.jpg",
  "alternativeText": null,
  "caption": null,
  "width": 1920,
  "height": 1080,
  "formats": {
    "thumbnail": {
      "name": "thumbnail_image.jpg",
      "hash": "thumbnail_image_hash",
      "ext": ".jpg",
      "mime": "image/jpeg",
      "width": 245,
      "height": 138,
      "size": 12.34,
      "url": "/uploads/thumbnail_image_hash.jpg"
    },
    "medium": {
      "name": "medium_image.jpg",
      "hash": "medium_image_hash",
      "ext": ".jpg",
      "mime": "image/jpeg",
      "width": 750,
      "height": 422,
      "size": 45.67,
      "url": "/uploads/medium_image_hash.jpg"
    }
  },
  "hash": "image_hash",
  "ext": ".jpg",
  "mime": "image/jpeg",
  "size": 123.45,
  "url": "/uploads/image_hash.jpg",
  "previewUrl": null,
  "provider": "local",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## React Example - Complete Upload Component

```jsx
import React, { useState } from 'react';
import axios from 'axios';

function FileUploader({ articleId, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];

    // Validate
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type)) {
      setError('Only JPEG, PNG, and WebP files are allowed');
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
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
          }
        }
      );

      onUploadSuccess(response.data[0]);
      setFile(null);
      setProgress(0);
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
          <p>Selected: {file.name}</p>
          <button onClick={handleUpload} disabled={uploading}>
            {uploading ? `Uploading... ${progress}%` : 'Upload'}
          </button>
        </div>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

export default FileUploader;
```

## Best Practices

### 1. File Size Limits
```javascript
// Her zaman dosya boyutu limiti belirleyin
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
```

### 2. File Type Whitelist
```javascript
// Allowed types listesi kullanın (blacklist değil)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
```

### 3. Unique File Names
```javascript
// Dosya adlarını unique yapın
const uniqueName = `${Date.now()}-${sanitizeFileName(file.name)}`;
```

### 4. Error Handling
```javascript
// Her zaman try-catch kullanın
try {
  await uploadFile();
} catch (err) {
  strapi.log.error('Upload failed:', err);
  return ctx.internalServerError();
}
```

### 5. Progress Tracking
```javascript
// Büyük dosyalar için progress tracking ekleyin
onUploadProgress: (progressEvent) => {
  const percentCompleted = Math.round(
    (progressEvent.loaded * 100) / progressEvent.total
  );
  console.log(percentCompleted);
}
```

## Kaynaklar

- [Upload Setup](12-upload-setup.md)
- [Media Library](13-media-library.md)
- [Image Processing](15-image-processing.md)
- [Official Strapi Upload Docs](https://docs.strapi.io/dev-docs/plugins/upload)
