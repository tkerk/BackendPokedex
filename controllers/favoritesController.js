const favoritesService = require('../services/favoritesService');

const getFavorites = async (req, res) => {
  try {
    const favorites = await favoritesService.getFavorites(req.user.id);
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addFavorite = async (req, res) => {
  try {
    const { pokemonId, pokemonName } = req.body;

    if (!pokemonId || !pokemonName) {
      return res.status(400).json({ error: 'pokemonId y pokemonName son requeridos' });
    }

    const favorite = await favoritesService.addFavorite(req.user.id, pokemonId, pokemonName);
    res.status(201).json(favorite);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const removeFavorite = async (req, res) => {
  try {
    const { pokemonId } = req.params;
    const removed = await favoritesService.removeFavorite(req.user.id, parseInt(pokemonId));
    res.json(removed);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

module.exports = { getFavorites, addFavorite, removeFavorite };
