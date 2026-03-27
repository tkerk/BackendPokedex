const pool = require('../db');

class TeamsService {
  async getTeams(userId) {
    const teams = await pool.query(
      'SELECT * FROM teams WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    // Cargar miembros de cada equipo
    const result = [];
    for (const team of teams.rows) {
      const members = await pool.query(
        'SELECT * FROM team_members WHERE team_id = $1 ORDER BY position',
        [team.id]
      );
      result.push({ ...team, members: members.rows });
    }
    return result;
  }

  async createTeam(userId, teamName, members) {
    if (!members || members.length !== 6) {
      throw new Error('Un equipo debe tener exactamente 6 Pokémon');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const teamResult = await client.query(
        'INSERT INTO teams (user_id, team_name) VALUES ($1, $2) RETURNING *',
        [userId, teamName]
      );
      const team = teamResult.rows[0];

      for (let i = 0; i < members.length; i++) {
        const moves = members[i].moves ? JSON.stringify(members[i].moves) : '[]';
        await client.query(
          'INSERT INTO team_members (team_id, pokemon_id, pokemon_name, position, moves) VALUES ($1, $2, $3, $4, $5)',
          [team.id, members[i].pokemonId, members[i].pokemonName, i + 1, moves]
        );
      }

      await client.query('COMMIT');

      const teamMembers = await pool.query(
        'SELECT * FROM team_members WHERE team_id = $1 ORDER BY position',
        [team.id]
      );
      return { ...team, members: teamMembers.rows };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async deleteTeam(userId, teamId) {
    const result = await pool.query(
      'DELETE FROM teams WHERE id = $1 AND user_id = $2 RETURNING *',
      [teamId, userId]
    );
    if (result.rows.length === 0) throw new Error('Equipo no encontrado');
    return result.rows[0];
  }

  async toggleActive(userId, teamId) {
    const result = await pool.query(
      'UPDATE teams SET is_active = NOT is_active WHERE id = $1 AND user_id = $2 RETURNING *',
      [teamId, userId]
    );
    if (result.rows.length === 0) throw new Error('Equipo no encontrado');
    return result.rows[0];
  }
}

module.exports = new TeamsService();
