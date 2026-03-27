const express = require('express');
const router = express.Router();
const { subscribe, unsubscribe, getVapidKey } = require('../controllers/pushController');
const authMiddleware = require('../middleware/auth');

// Obtener VAPID public key (no requiere auth)
router.get('/vapid-key', getVapidKey);

// Suscribirse / desuscribirse (requiere auth)
router.post('/subscribe', authMiddleware, subscribe);
router.delete('/unsubscribe', authMiddleware, unsubscribe);

module.exports = router;
