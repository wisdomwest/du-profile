const express = require('express');
const multer = require('multer');
const path = require('path');
const publicationsController = require('../controllers/publications');

const router = express.Router();

// Configure dynamic local storage for CSV uploads
const uploadDir = path.join(__dirname, '../../uploads/');
const upload = multer({ dest: uploadDir });

// Register REST endpoints mapped to controller operations
router.get('/schools', publicationsController.getSchools);
router.get('/publications', publicationsController.getPublications);
router.get('/stats', publicationsController.getStats);
router.get('/export-csv', publicationsController.exportCSV);

router.post('/upload-csv', upload.single('file'), publicationsController.uploadCSV);
router.post('/harvest', publicationsController.harvest);
router.post('/ai-insight', publicationsController.aiInsight);
router.post('/reanalyze-sdgs', publicationsController.reanalyzeSDGs);

module.exports = router;
