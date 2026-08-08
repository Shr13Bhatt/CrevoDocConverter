const path = require('path');
const fs = require('fs');

// Configuration for validation based on converter type
const CONVERTER_CONFIGS = {
  'word-to-pdf': {
    allowedExtensions: ['.doc', '.docx'],
    allowedMimeTypes: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream'
    ],
    maxSize: 50 * 1024 * 1024 // 50MB
  },
  'pdf-to-word': {
    allowedExtensions: ['.pdf'],
    allowedMimeTypes: ['application/pdf'],
    maxSize: 50 * 1024 * 1024
  },
  'ppt-to-pdf': {
    allowedExtensions: ['.ppt', '.pptx'],
    allowedMimeTypes: [
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/octet-stream'
    ],
    maxSize: 50 * 1024 * 1024
  },
  'pdf-to-ppt': {
    allowedExtensions: ['.pdf'],
    allowedMimeTypes: ['application/pdf'],
    maxSize: 50 * 1024 * 1024
  },
  'jpg-to-pdf': {
    allowedExtensions: ['.jpg', '.jpeg'],
    allowedMimeTypes: ['image/jpeg', 'image/pjpeg'],
    maxSize: 20 * 1024 * 1024 // 20MB
  },
  'png-to-pdf': {
    allowedExtensions: ['.png'],
    allowedMimeTypes: ['image/png'],
    maxSize: 20 * 1024 * 1024
  },
  'webp-to-jpg': {
    allowedExtensions: ['.webp'],
    allowedMimeTypes: ['image/webp'],
    maxSize: 20 * 1024 * 1024
  },
  'jpg-to-png': {
    allowedExtensions: ['.jpg', '.jpeg'],
    allowedMimeTypes: ['image/jpeg', 'image/pjpeg'],
    maxSize: 20 * 1024 * 1024
  },
  'png-to-jpg': {
    allowedExtensions: ['.png'],
    allowedMimeTypes: ['image/png'],
    maxSize: 20 * 1024 * 1024
  },
  'pdf-to-jpg': {
    allowedExtensions: ['.pdf'],
    allowedMimeTypes: ['application/pdf'],
    maxSize: 50 * 1024 * 1024
  },
  'pdf-to-png': {
    allowedExtensions: ['.pdf'],
    allowedMimeTypes: ['application/pdf'],
    maxSize: 50 * 1024 * 1024
  },
  'txt-to-pdf': {
    allowedExtensions: ['.txt'],
    allowedMimeTypes: ['text/plain'],
    maxSize: 10 * 1024 * 1024 // 10MB
  },
  'txt-to-word': {
    allowedExtensions: ['.txt'],
    allowedMimeTypes: ['text/plain'],
    maxSize: 10 * 1024 * 1024
  }
};

function fileValidator(toolType) {
  return (req, res, next) => {
    const config = CONVERTER_CONFIGS[toolType];
    if (!config) {
      return res.status(400).json({ error: 'Invalid converter tool configuration.' });
    }

    const files = req.files || (req.file ? [req.file] : []);
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded. Please choose a file.' });
    }

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      
      // 1. Validate extension
      if (!config.allowedExtensions.includes(ext)) {
        cleanupUploadedFiles(files);
        return res.status(400).json({ error: `Unsupported file format. Supported: ${config.allowedExtensions.join(', ').toUpperCase()}` });
      }

      // 2. Validate size
      if (file.size > config.maxSize) {
        cleanupUploadedFiles(files);
        const limitMB = Math.round(config.maxSize / (1024 * 1024));
        return res.status(400).json({ error: `File size exceeds the allowed limit of ${limitMB}MB.` });
      }

      // 3. Validate empty/corrupted
      if (file.size === 0) {
        cleanupUploadedFiles(files);
        return res.status(400).json({ error: 'This file appears to be empty or corrupted.' });
      }
    }

    next();
  };
}

function cleanupUploadedFiles(files) {
  if (!files) return;
  const fileArray = Array.isArray(files) ? files : Object.values(files).flat();
  for (const file of fileArray) {
    if (file && file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.error(`Failed to delete temp file ${file.path}:`, err);
      }
    }
  }
}

module.exports = {
  fileValidator,
  cleanupUploadedFiles,
  CONVERTER_CONFIGS
};
