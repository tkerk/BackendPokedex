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

module.exports = { challenge };
