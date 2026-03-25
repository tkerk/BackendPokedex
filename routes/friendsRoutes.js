const express = require('express');
const router = express.Router();
const { searchByCode, sendRequest, acceptRequest, rejectRequest, getFriends, getPendingRequests } = require('../controllers/friendsController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);
router.get('/', getFriends);
router.get('/pending', getPendingRequests);
router.get('/search/:code', searchByCode);
router.post('/request', sendRequest);
router.patch('/:id/accept', acceptRequest);
router.patch('/:id/reject', rejectRequest);

module.exports = router;
