const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

class AuthService {
  async register(name, email, password) {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new Error('El correo ya está registrado');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generar friend_code único de 8 chars
    const friendCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const result = await pool.query(
      'INSERT INTO users (name, email, password, friend_code) VALUES ($1, $2, $3, $4) RETURNING id, name, email, friend_code, created_at',
      [name, email, hashedPassword, friendCode]
    );

    const user = result.rows[0];
    const token = this.generateToken(user);

    return { user, token };
  }

  async login(email, password) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      throw new Error('Credenciales inválidas');
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Credenciales inválidas');
    }

    // Marcar como online
    await pool.query('UPDATE users SET is_online = true WHERE id = $1', [user.id]);

    const token = this.generateToken(user);
    delete user.password;

    return { user, token };
  }

  async getProfile(userId) {
    const result = await pool.query(
      'SELECT id, name, email, friend_code, is_online, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    return result.rows[0];
  }

  async logout(userId) {
    await pool.query('UPDATE users SET is_online = false WHERE id = $1', [userId]);
  }

  generateToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }
}

module.exports = new AuthService();
