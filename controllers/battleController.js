const battleService = require('../services/battleService');

const challenge = async (req, res) => {
  try {
    const { opponentId } = req.body;
    if (!opponentId) return res.status(400).json({ error: 'ID del oponente requerido' });
    const result = await battleService.createChallenge(req.user.id, parseInt(opponentId));
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const acceptChallenge = async (req, res) => {
  try {
    const result = await battleService.acceptChallenge(req.user.id, parseInt(req.params.id));
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

const rejectChallenge = async (req, res) => {
  try {
    const result = await battleService.rejectChallenge(req.user.id, parseInt(req.params.id));
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

const getPendingChallenges = async (req, res) => {
  try {
    const result = await battleService.getPendingChallenges(req.user.id);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { challenge, acceptChallenge, rejectChallenge, getPendingChallenges };
