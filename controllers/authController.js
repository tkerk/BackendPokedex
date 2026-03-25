const authService = require('../services/authService');

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const result = await authService.register(name, email, password);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    const result = await authService.login(email, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await authService.getProfile(req.user.id);
    res.json(user);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    await authService.logout(req.user.id);
    res.json({ message: 'Sesión cerrada exitosamente' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

module.exports = { register, login, getProfile, logout };
