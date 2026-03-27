const express = require('express');
const router = express.Router();
const { challenge, acceptChallenge, rejectChallenge, getPendingChallenges } = require('../controllers/battleController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);
router.post('/challenge', challenge);
router.post('/accept/:id', acceptChallenge);
router.post('/reject/:id', rejectChallenge);
router.get('/pending', getPendingChallenges);

module.exports = router;
