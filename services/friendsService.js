const pool = require('../db');
const pushService = require('./pushService');

class FriendsService {
  async searchByCode(friendCode) {
    const result = await pool.query(
      'SELECT id, name, friend_code, is_online FROM users WHERE friend_code = $1',
      [friendCode.toUpperCase()]
    );
    if (result.rows.length === 0) throw new Error('Usuario no encontrado');
    return result.rows[0];
  }

  async sendRequest(userId, friendCode) {
    const friend = await this.searchByCode(friendCode);
    if (friend.id === userId) throw new Error('No puedes agregarte a ti mismo');

    const existing = await pool.query(
      `SELECT * FROM friendships 
       WHERE ((user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1))
       AND status IN ('pending', 'accepted')`,
      [userId, friend.id]
    );
    if (existing.rows.length > 0) throw new Error('Ya existe una solicitud con este usuario');

    const result = await pool.query(
      'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3) RETURNING *',
      [userId, friend.id, 'pending']
    );

    // Obtener nombre del solicitante
    const sender = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
    const senderName = sender.rows[0]?.name || 'Alguien';

    // Enviar push notification al destinatario (no es crítico, atrapar errores)
    try {
      await pushService.sendNotification(friend.id, {
        title: '👥 ¡Nueva solicitud de amistad!',
        body: `${senderName} quiere ser tu amigo`,
        icon: '/Logo.png',
        badge: '/Logo.png',
        tag: 'friend-request',
        data: {
          type: 'friend_request',
          friendshipId: result.rows[0].id,
          senderName,
          url: '/friends',
        },
      });
    } catch (e) {
      console.error('[Push] Fallo enviando notificación de amistad:', e.message);
    }

    return result.rows[0];
  }


  async acceptRequest(userId, friendshipId) {
    const result = await pool.query(
      'UPDATE friendships SET status = $1 WHERE id = $2 AND friend_id = $3 RETURNING *',
      ['accepted', friendshipId, userId]
    );
    if (result.rows.length === 0) throw new Error('Solicitud no encontrada');
    return result.rows[0];
  }

  async rejectRequest(userId, friendshipId) {
    const result = await pool.query(
      'UPDATE friendships SET status = $1 WHERE id = $2 AND friend_id = $3 RETURNING *',
      ['rejected', friendshipId, userId]
    );
    if (result.rows.length === 0) throw new Error('Solicitud no encontrada');
    return result.rows[0];
  }

  async getFriends(userId) {
    const result = await pool.query(`
      SELECT f.id as friendship_id, f.status, f.created_at,
        CASE WHEN f.user_id = $1 THEN u2.id ELSE u1.id END as friend_id,
        CASE WHEN f.user_id = $1 THEN u2.name ELSE u1.name END as friend_name,
        CASE WHEN f.user_id = $1 THEN u2.friend_code ELSE u1.friend_code END as friend_code,
        CASE WHEN f.user_id = $1 THEN u2.is_online ELSE u1.is_online END as is_online
      FROM friendships f
      JOIN users u1 ON f.user_id = u1.id
      JOIN users u2 ON f.friend_id = u2.id
      WHERE (f.user_id = $1 OR f.friend_id = $1)
      ORDER BY f.created_at DESC
    `, [userId]);
    return result.rows;
  }

  async getPendingRequests(userId) {
    const result = await pool.query(`
      SELECT f.id as friendship_id, f.created_at, u.name as from_name, u.friend_code
      FROM friendships f
      JOIN users u ON f.user_id = u.id
      WHERE f.friend_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `, [userId]);
    return result.rows;
  }

  async setOnline(userId, online) {
    await pool.query('UPDATE users SET is_online = $1 WHERE id = $2', [online, userId]);
  }
}

module.exports = new FriendsService();
