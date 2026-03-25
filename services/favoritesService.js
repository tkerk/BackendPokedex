const pool = require('../db');

class FavoritesService {
  async getFavorites(userId) {
    const result = await pool.query(
      'SELECT id, pokemon_id, pokemon_name, created_at FROM favorites WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  async addFavorite(userId, pokemonId, pokemonName) {
    // Verificar si ya existe
    const existing = await pool.query(
      'SELECT id FROM favorites WHERE user_id = $1 AND pokemon_id = $2',
      [userId, pokemonId]
    );

    if (existing.rows.length > 0) {
      throw new Error('Este Pokémon ya está en tus favoritos');
    }

    const result = await pool.query(
      'INSERT INTO favorites (user_id, pokemon_id, pokemon_name) VALUES ($1, $2, $3) RETURNING *',
      [userId, pokemonId, pokemonName]
    );

    return result.rows[0];
  }

  async removeFavorite(userId, pokemonId) {
    const result = await pool.query(
      'DELETE FROM favorites WHERE user_id = $1 AND pokemon_id = $2 RETURNING *',
      [userId, pokemonId]
    );

    if (result.rows.length === 0) {
      throw new Error('Favorito no encontrado');
    }

    return result.rows[0];
  }
}

module.exports = new FavoritesService();
