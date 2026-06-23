import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

function checkFileType(file, cb) {
  const filetypes = /mp4|mkv|avi|mov|webm/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Videos only!'));
  }
}

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

router.post('/', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).send({ message: 'No video file provided' });
  }
  
  // Return the path that can be accessed from the frontend
  res.send({
    message: 'Video Uploaded Successfully',
    videoUrl: `/uploads/${req.file.filename}`,
  });
});

function checkImageFileType(file, cb) {
  const filetypes = /jpg|jpeg|png|gif|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Images only!'));
  }
}

const uploadImage = multer({
  storage,
  fileFilter: function (req, file, cb) {
    checkImageFileType(file, cb);
  },
});

router.post('/image', uploadImage.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).send({ message: 'No image file provided' });
  }
  
  res.send({
    message: 'Image Uploaded Successfully',
    imageUrl: `/uploads/${req.file.filename}`,
  });
});

function checkDocumentFileType(file, cb) {
  const filetypes = /pdf|doc|docx|ppt|pptx|txt|jpg|jpeg|png|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  
  if (extname) {
    return cb(null, true);
  } else {
    cb(new Error('Documents and Images only!'));
  }
}

const uploadDocument = multer({
  storage,
  fileFilter: function (req, file, cb) {
    checkDocumentFileType(file, cb);
  },
});

router.post('/document', uploadDocument.single('document'), (req, res) => {
  if (!req.file) {
    return res.status(400).send({ message: 'No document file provided' });
  }
  
  res.send({
    message: 'Document Uploaded Successfully',
    documentUrl: `/uploads/${req.file.filename}`,
  });
});

export default router;
