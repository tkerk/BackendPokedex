const express = require('express');
const router = express.Router();
const { getTeams, createTeam, deleteTeam, toggleActive } = require('../controllers/teamsController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);
router.get('/', getTeams);
router.post('/', createTeam);
router.delete('/:teamId', deleteTeam);
router.patch('/:teamId/toggle', toggleActive);

module.exports = router;
