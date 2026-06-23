import express from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Ensure temp uploads directory exists for multer buffer
const tempDir = 'uploads/temp/';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Multer stores files temporarily on disk before Cloudinary upload
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, tempDir);
  },
  filename(req, file, cb) {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// --- File type validators ---
function checkVideoFileType(file, cb) {
  const filetypes = /mp4|mkv|avi|mov|webm/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /video/.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error('Videos only!'));
}

function checkImageFileType(file, cb) {
  const filetypes = /jpg|jpeg|png|gif|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /image/.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error('Images only!'));
}

function checkDocumentFileType(file, cb) {
  const filetypes = /pdf|doc|docx|ppt|pptx|txt|jpg|jpeg|png|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  if (extname) return cb(null, true);
  cb(new Error('Documents and Images only!'));
}

const uploadVideo = multer({ storage, fileFilter: (req, file, cb) => checkVideoFileType(file, cb) });
const uploadImage = multer({ storage, fileFilter: (req, file, cb) => checkImageFileType(file, cb) });
const uploadDocument = multer({ storage, fileFilter: (req, file, cb) => checkDocumentFileType(file, cb) });

// Helper: upload file to Cloudinary and clean up temp file
async function uploadToCloudinary(filePath, options = {}) {
  try {
    const result = await cloudinary.uploader.upload(filePath, options);
    // Remove temp file after successful upload
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete temp file:', err);
    });
    return result;
  } catch (error) {
    // Remove temp file even on failure
    fs.unlink(filePath, () => {});
    throw error;
  }
}

// ==================== VIDEO UPLOAD ====================
router.post('/', (req, res, next) => {
  uploadVideo.single('video')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Invalid file type' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No video file provided' });
  }

  try {
    const result = await uploadToCloudinary(req.file.path, {
      resource_type: 'video',
      folder: 'e-learning/videos',
      chunk_size: 6000000, // 6MB chunks for large videos
    });

    res.json({
      message: 'Video Uploaded Successfully',
      videoUrl: result.secure_url,
    });
  } catch (error) {
    console.error('Cloudinary video upload error:', error);
    res.status(500).json({ message: 'Failed to upload video to cloud storage' });
  }
});

// ==================== IMAGE UPLOAD ====================
router.post('/image', (req, res, next) => {
  uploadImage.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Invalid file type' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided' });
  }

  try {
    const result = await uploadToCloudinary(req.file.path, {
      resource_type: 'image',
      folder: 'e-learning/images',
      transformation: [
        { width: 1200, crop: 'limit' }, // Optimize: cap width at 1200px
        { quality: 'auto', fetch_format: 'auto' }, // Auto-optimize quality & format
      ],
    });

    res.json({
      message: 'Image Uploaded Successfully',
      imageUrl: result.secure_url,
    });
  } catch (error) {
    console.error('Cloudinary image upload error:', error);
    res.status(500).json({ message: 'Failed to upload image to cloud storage' });
  }
});

// ==================== DOCUMENT UPLOAD ====================
router.post('/document', (req, res, next) => {
  uploadDocument.single('document')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Invalid file type' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No document file provided' });
  }

  try {
    // Check if the document is actually an image
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(req.file.originalname);
    
    const result = await uploadToCloudinary(req.file.path, {
      resource_type: isImage ? 'image' : 'raw',
      folder: 'e-learning/documents',
    });

    res.json({
      message: 'Document Uploaded Successfully',
      documentUrl: result.secure_url,
    });
  } catch (error) {
    console.error('Cloudinary document upload error:', error);
    res.status(500).json({ message: 'Failed to upload document to cloud storage' });
  }
});

export default router;

