const express = require('express');
const router = express.Router();
const { getFavorites, addFavorite, removeFavorite } = require('../controllers/favoritesController');
const authMiddleware = require('../middleware/auth');

// Todas las rutas de favoritos requieren autenticación
router.use(authMiddleware);

router.get('/', getFavorites);
router.post('/', addFavorite);
router.delete('/:pokemonId', removeFavorite);

module.exports = router;
