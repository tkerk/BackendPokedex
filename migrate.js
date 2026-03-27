const pool = require('./db');
const crypto = require('crypto');

const migrate = async () => {
  try {
    console.log('🔄 Ejecutando migraciones...');

    // Tabla de usuarios (con friend_code y is_online)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        friend_code VARCHAR(8) UNIQUE,
        is_online BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla "users" creada/verificada');

    // Agregar columnas si no existen (para upgrades)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='friend_code') THEN
          ALTER TABLE users ADD COLUMN friend_code VARCHAR(8) UNIQUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_online') THEN
          ALTER TABLE users ADD COLUMN is_online BOOLEAN DEFAULT false;
        END IF;
      END $$;
    `);

    // Generar friend_code para usuarios que no tienen
    const noCode = await pool.query('SELECT id FROM users WHERE friend_code IS NULL');
    for (const user of noCode.rows) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      await pool.query('UPDATE users SET friend_code = $1 WHERE id = $2', [code, user.id]);
    }

    // Tabla de favoritos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pokemon_id INTEGER NOT NULL,
        pokemon_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, pokemon_id)
      );
    `);
    console.log('✅ Tabla "favorites" creada/verificada');

    // Tabla de equipos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        team_name VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla "teams" creada/verificada');

    // Tabla de miembros del equipo
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        pokemon_id INTEGER NOT NULL,
        pokemon_name VARCHAR(100) NOT NULL,
        position INTEGER NOT NULL CHECK(position >= 1 AND position <= 6),
        UNIQUE(team_id, position)
      );
    `);
    console.log('✅ Tabla "team_members" creada/verificada');

    // Tabla de amistades
    await pool.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, friend_id)
      );
    `);
    console.log('✅ Tabla "friendships" creada/verificada');

    // Tabla de suscripciones push
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
    `);
    console.log('✅ Tabla "push_subscriptions" creada/verificada');

    // Tabla de retos de batalla
    await pool.query(`
      CREATE TABLE IF NOT EXISTS battle_challenges (
        id SERIAL PRIMARY KEY,
        challenger_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        opponent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla "battle_challenges" creada/verificada');

    // Índices
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_friend_code ON users(friend_code);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_battle_challenges_opponent ON battle_challenges(opponent_id);`);
    console.log('✅ Índices creados/verificados');

    console.log('🎉 Migraciones completadas exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migraciones:', error.message);
    process.exit(1);
  }
};

migrate();
