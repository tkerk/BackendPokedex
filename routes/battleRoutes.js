const express = require('express');
const router = express.Router();
const { challenge } = require('../controllers/battleController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);
router.post('/challenge', challenge);

module.exports = router;
