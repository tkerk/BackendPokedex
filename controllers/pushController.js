const pushService = require('../services/pushService');

const subscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Suscripción inválida' });
    }
    const result = await pushService.subscribe(req.user.id, subscription);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const unsubscribe = async (req, res) => {
  try {
    const result = await pushService.unsubscribe(req.user.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getVapidKey = (req, res) => {
  res.json({ publicKey: pushService.getPublicKey() });
};

module.exports = { subscribe, unsubscribe, getVapidKey };
