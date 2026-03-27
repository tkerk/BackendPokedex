const pool = require('../db');
const pushService = require('../services/pushService');

class BattleService {
  async createChallenge(challengerId, opponentId) {
    // Verificar que son amigos
    const friendship = await pool.query(
      `SELECT id FROM friendships 
       WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) 
       AND status = 'accepted'`,
      [challengerId, opponentId]
    );
    if (friendship.rows.length === 0) {
      throw new Error('Solo puedes retar a tus amigos');
    }

    // Obtener info del retador
    const challenger = await pool.query(
      'SELECT name FROM users WHERE id = $1',
      [challengerId]
    );

    // Obtener equipo activo del retador
    const activeTeam = await pool.query(
      `SELECT t.team_name, array_agg(tm.pokemon_name ORDER BY tm.position) as pokemon_names
       FROM teams t JOIN team_members tm ON t.id = tm.team_id
       WHERE t.user_id = $1 AND t.is_active = true
       GROUP BY t.id, t.team_name LIMIT 1`,
      [challengerId]
    );

    const teamInfo = activeTeam.rows.length > 0
      ? `con su equipo "${activeTeam.rows[0].team_name}"`
      : '';

    // Crear registro del reto
    const result = await pool.query(
      'INSERT INTO battle_challenges (challenger_id, opponent_id, status) VALUES ($1, $2, $3) RETURNING *',
      [challengerId, opponentId, 'pending']
    );

    // Enviar push notification al oponente (no bloquear si falla)
    try {
      await pushService.sendNotification(opponentId, {
        title: '⚔️ ¡Reto de Batalla!',
        body: `${challenger.rows[0].name} te ha retado a una batalla ${teamInfo}`,
        icon: '/Logo.png',
        badge: '/Logo.png',
        tag: 'battle-challenge',
        data: {
          type: 'battle_challenge',
          challengeId: result.rows[0].id,
          challengerName: challenger.rows[0].name,
          url: '/friends',
        },
      });
    } catch (e) {
      console.error('[Push] Fallo enviando notificación de batalla:', e.message);
    }

    return result.rows[0];
  }
}

module.exports = new BattleService();
