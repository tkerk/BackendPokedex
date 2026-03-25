const friendsService = require('../services/friendsService');

const searchByCode = async (req, res) => {
  try {
    const user = await friendsService.searchByCode(req.params.code);
    res.json(user);
  } catch (e) { res.status(404).json({ error: e.message }); }
};

const sendRequest = async (req, res) => {
  try {
    const { friendCode } = req.body;
    if (!friendCode) return res.status(400).json({ error: 'Código de amigo requerido' });
    const friendship = await friendsService.sendRequest(req.user.id, friendCode);
    res.status(201).json(friendship);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

const acceptRequest = async (req, res) => {
  try {
    const result = await friendsService.acceptRequest(req.user.id, parseInt(req.params.id));
    res.json(result);
  } catch (e) { res.status(404).json({ error: e.message }); }
};

const rejectRequest = async (req, res) => {
  try {
    const result = await friendsService.rejectRequest(req.user.id, parseInt(req.params.id));
    res.json(result);
  } catch (e) { res.status(404).json({ error: e.message }); }
};

const getFriends = async (req, res) => {
  try {
    const friends = await friendsService.getFriends(req.user.id);
    res.json(friends);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const getPendingRequests = async (req, res) => {
  try {
    const pending = await friendsService.getPendingRequests(req.user.id);
    res.json(pending);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { searchByCode, sendRequest, acceptRequest, rejectRequest, getFriends, getPendingRequests };
