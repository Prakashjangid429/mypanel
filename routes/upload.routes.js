import express from 'express';
import multerConfig from '../middleware/multerConfig.js';

const router = express.Router();

router.post('/single', multerConfig.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({
        success: true,
        url: fileUrl,
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
    });
});

router.post('/multiple', multerConfig.array('files', 5), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map(file => ({
        url: `${req.protocol}://${req.get('host')}/uploads/${file.filename}`,
        name: file.originalname,
        size: file.size,
        type: file.mimetype
    }));

    res.json({
        success: true,
        files: uploadedFiles
    });
});

export default router;