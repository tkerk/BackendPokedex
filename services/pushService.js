const webpush = require('web-push');
const pool = require('../db');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

let publicKey = process.env.VAPID_PUBLIC_KEY;
let privateKey = process.env.VAPID_PRIVATE_KEY;

// Intentar leer de web-push-key.json si no están en .env
try {
  const keyPath = path.join(__dirname, '../web-push-key.json');
  if (fs.existsSync(keyPath)) {
    const keys = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    publicKey = publicKey || keys.publicKey;
    privateKey = privateKey || keys.privateKey;
  }
} catch (err) {
  console.log('[Push] No se pudo leer web-push-key.json', err.message);
}

// Configurar VAPID
webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:pokedex@example.com',
  publicKey,
  privateKey
);


class PushService {
  async subscribe(userId, subscription) {
    // Eliminar suscripción anterior del usuario si existe
    await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);

    await pool.query(
      'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)',
      [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
    );
    return { success: true };
  }

  async unsubscribe(userId) {
    await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
    return { success: true };
  }

  async sendNotification(userId, payload) {
    const result = await pool.query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      console.log(`[Push] No hay suscripción para usuario ${userId}`);
      return;
    }

    const sub = result.rows[0];
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload)
      );
      console.log(`[Push] Notificación enviada a usuario ${userId}`);
    } catch (error) {
      console.error(`[Push] Error enviando a usuario ${userId}:`, error.message);
      // Si la suscripción expiró (410 Gone), eliminarla
      if (error.statusCode === 410 || error.statusCode === 404) {
        await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
        console.log(`[Push] Suscripción expirada eliminada para usuario ${userId}`);
      }
    }
  }

  getPublicKey() {
    return publicKey;
  }
}

module.exports = new PushService();
