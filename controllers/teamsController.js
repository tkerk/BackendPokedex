const teamsService = require('../services/teamsService');

const getTeams = async (req, res) => {
  try {
    const teams = await teamsService.getTeams(req.user.id);
    res.json(teams);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const createTeam = async (req, res) => {
  try {
    const { teamName, members } = req.body;
    if (!teamName) return res.status(400).json({ error: 'Nombre del equipo requerido' });
    const team = await teamsService.createTeam(req.user.id, teamName, members);
    res.status(201).json(team);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

const deleteTeam = async (req, res) => {
  try {
    await teamsService.deleteTeam(req.user.id, parseInt(req.params.teamId));
    res.json({ message: 'Equipo eliminado' });
  } catch (e) { res.status(404).json({ error: e.message }); }
};

const toggleActive = async (req, res) => {
  try {
    const team = await teamsService.toggleActive(req.user.id, parseInt(req.params.teamId));
    res.json(team);
  } catch (e) { res.status(404).json({ error: e.message }); }
};

module.exports = { getTeams, createTeam, deleteTeam, toggleActive };
