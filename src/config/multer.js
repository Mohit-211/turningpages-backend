// const multer = require('multer');
// const path = require('path');
// const ApiError = require('../utils/ApiError');
// const httpStatus = require('http-status');
// const uploadToGCS = require('./gcsUpload');

// // Set storage engine to memory storage
// const storage = multer.memoryStorage();

// // Check file type
// function checkFileType(file, cb) {
//   const allowedFiletypes = ['jpeg', 'jpg', 'png', 'gif', 'mp4', 'mov', 'pdf', 'mp3', 'doc', 'docx'];

//   const fileExtension = path.extname(file.originalname).toLowerCase();
//   const isValidExtension = allowedFiletypes.includes(fileExtension.substring(1));

//   const isValidMimeType =
//     file.mimetype.startsWith('image/') ||
//     file.mimetype.startsWith('video/') ||
//     file.mimetype.startsWith('application/pdf') ||
//     file.mimetype.startsWith('audio/') ||
//     file.mimetype === 'application/msword' ||
//     file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

//   if (isValidExtension && isValidMimeType) {
//     return cb(null, true);
//   } else {
//     return cb(new ApiError(httpStatus.BAD_REQUEST, 'Error: Only Images(.jpeg, .jpg, .png), Videos(.mp4, .mov), Audio(.mp3), and Files(.pdf, .doc, .docx) are allowed!'));
//   }
// }

// // Init upload
// const upload = multer({
//   storage: storage,
//   fileFilter: function (req, file, cb) {
//     checkFileType(file, cb);
//   },
// }).fields([
//   { name: 'gifs', maxCount: 10 },
//   { name: 'images', maxCount: 10 },
//   { name: 'videos', maxCount: 10 },
//   { name: 'docs', maxCount: 10 },
//   { name: 'audios', maxCount: 10 },
// ]);

// // Middleware to handle file uploads and call uploadToGCS
// const handleFileUploads = (req, res, next) => {
//   upload(req, res, async (err) => {
//     if (err) {
//       return next(err);
//     }

//     try {
//       const uploadPromises = [];
//       const fileTypes = ['gifs', 'images', 'videos', 'docs', 'audios'];

//       fileTypes.forEach((type) => {
//         if (req.files && req.files[type]) {
//           req.files[type].forEach((file) => {
//             uploadPromises.push(uploadToGCS(file));
//           });
//         }
//       });

//       const uploadedFiles = await Promise.all(uploadPromises);
//       req.uploadedFiles = uploadedFiles;
//       next();
//     } catch (uploadError) {
//       next(uploadError);
//     }
//   });
// };

// module.exports = handleFileUploads;


const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');
const config = require('./config');

// Define base directory for uploads
const PUBLIC_DIR = path.resolve(__dirname, '../../public/uploads');

// Ensure all required directories exist
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Define allowed file categories and folders
const fileCategories = {
  images: ['jpeg', 'jpg', 'png', 'webp'],
  videos: ['mp4', 'mov'],
  gifs: ['gif'],
  docs: ['pdf', 'doc', 'docx'],
  audios: ['mp3'],
};

// Get correct upload folder based on file fieldname
const getUploadFolder = (fieldname) => {
  const categoryFolders = {
    gifs: 'gifs',
    images: 'images',
    videos: 'videos',
    docs: 'docs',
    audios: 'audios',
  };

  return categoryFolders[fieldname] || 'others';
};

// Ensure all category directories exist
Object.keys(fileCategories).forEach((category) => {
  ensureDirectoryExists(path.join(PUBLIC_DIR, category));
});

// Set up multer storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadFolder = getUploadFolder(file.fieldname);
    const uploadPath = path.join(PUBLIC_DIR, uploadFolder);
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = getFileExtension(file);
    cb(null, `${file.fieldname}-${Date.now()}.${ext}`);
  },
});

// Validate file type
function checkFileType(file, cb) {
  const allowedFiletypes = ['jpeg', 'jpg', 'png', 'gif', 'mp4', 'mov', 'pdf', 'mp3', 'doc', 'docx', 'webp'];
  const fileExtension = path.extname(file.originalname).substring(1).toLowerCase();

  const isValidExtension = allowedFiletypes.includes(fileExtension);
  const isValidMimeType =
    file.mimetype.startsWith('image/') ||
    file.mimetype.startsWith('video/') ||
    file.mimetype.startsWith('application/pdf') ||
    file.mimetype.startsWith('audio/') ||
    file.mimetype === 'application/msword' ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (isValidExtension && isValidMimeType) {
    return cb(null, true);
  } else {
    return cb(new ApiError(httpStatus.BAD_REQUEST, 'Error: Invalid file type! Allowed: Images, Videos, Audio, Docs.'));
  }
}

// Get file extension based on MIME type
function getFileExtension(file) {
  const mimeToExtMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/png': 'png',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/mov': 'mov',
    'application/pdf': 'pdf',
    'audio/mpeg': 'mp3',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  };
  return mimeToExtMap[file.mimetype] || 'txt';
}

// Initialize multer upload
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
}).fields([
  { name: 'gifs', maxCount: 10 },
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 10 },
  { name: 'docs', maxCount: 10 },
  { name: 'audios', maxCount: 10 },
]);

// Middleware to handle file uploads
const handleFileUploads = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      return next(err);
    }

    try {

      const fileTypes = ['gifs', 'images', 'videos', 'docs', 'audios'];
      fileTypes.forEach((type) => {
        if (req.files && req.files[type]) {
          req.files[type] = req.files[type].map((file) => {
            return {
              ...file,
              filename: `${file.filename}`,
            }
          });
        }
      });

      next();
    } catch (uploadError) {
      next(uploadError);
    }
  });
};

module.exports = handleFileUploads;
