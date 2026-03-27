const pool = require('../db');
const jwt = require('jsonwebtoken');

class BattleEngine {
  constructor() {
    this.io = null;
    this.activeBattles = new Map(); // battleId -> { room, players: { socketId: userId }, state }
  }

  init(io) {
    this.io = io;

    // Authentication Middleware para WebSockets
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
      try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        socket.userId = decoded.id;
        next();
      } catch (err) {
        next(new Error('Authentication error: Invalid token'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`🔌 [Socket] Usuario conectado: ${socket.userId} (${socket.id})`);

      // Unirse a una batalla
      socket.on('join_battle', async ({ battleId }) => {
        try {
          // Validar que la batalla existe y fue aceptada en base de datos
          const battleCheck = await pool.query(
            'SELECT * FROM battle_challenges WHERE id = $1 AND status = $2',
            [battleId, 'accepted']
          );
          
          if (battleCheck.rows.length === 0) {
            return socket.emit('battle_error', { message: 'Batalla no válida o no aceptada' });
          }
          const battleRecord = battleCheck.rows[0];

          // Validar que el usuario es participante
          if (battleRecord.challenger_id !== socket.userId && battleRecord.opponent_id !== socket.userId) {
            return socket.emit('battle_error', { message: 'No eres parte de esta batalla' });
          }

          const room = `battle_${battleId}`;
          socket.join(room);

          // Inicializar estado de batalla en memoria si no existe
          if (!this.activeBattles.has(battleId)) {
            this.activeBattles.set(battleId, {
              id: battleId,
              room: room,
              challengerId: battleRecord.challenger_id,
              opponentId: battleRecord.opponent_id,
              playersReady: new Set(),
              teams: {},     // userId -> [pokemon]
              activePokemonIndex: {}, // userId -> index
              turnActions: {} // Las acciones elegidas este turno
            });
          }

          const battle = this.activeBattles.get(battleId);
          battle.playersReady.add(socket.userId);

          // Emitir al socket que se ha unido exitosamente
          socket.emit('battle_joined', { battleId });

          // Si ambos están listos y no se han cargado los equipos
          if (battle.playersReady.size === 2 && !battle.stateInitialized) {
            await this.initializeGameState(battle);
            battle.stateInitialized = true;
            // Notificar a ambos jugadores que la batalla arranca
            this.io.to(room).emit('battle_start', this.getSanitizedState(battle));
          } else if (battle.stateInitialized) {
            // Re-conexion
            socket.emit('battle_sync', this.getSanitizedState(battle));
          }

        } catch (error) {
          console.error('[Socket] Error join_battle', error);
          socket.emit('battle_error', { message: 'Error interno conectando a batalla' });
        }
      });

      // Manejar acciones del turno (ataque o cambio de pokemon)
      socket.on('battle_action', (data) => {
        const { battleId, actionType, moveIndex, switchIndex } = data;
        const battle = this.activeBattles.get(battleId);
        
        if (!battle || !battle.stateInitialized) return;
        
        // Guardar la accion
        battle.turnActions[socket.userId] = { type: actionType, moveIndex, switchIndex };

        // Si ambos han enviado su acción, resolver turno
        if (Object.keys(battle.turnActions).length === 2) {
          this.resolveTurn(battle);
        }
      });

      socket.on('disconnect', () => {
        console.log(`🔌 [Socket] Usuario desconectado: ${socket.userId} (${socket.id})`);
        // Aqui podríamos manejar un delay para declarar "abandono de partida" si se rompe la conexión
      });
    });
  }

  // Cargar equipos de la base de datos y preparar stats para la batalla
  async initializeGameState(battle) {
    const fetchTeam = async (userId) => {
      // Traer el equipo activo
      const teamRes = await pool.query(
        `SELECT * FROM teams WHERE user_id = $1 AND is_active = true LIMIT 1`,
        [userId]
      );
      if (teamRes.rows.length === 0) return [];

      const membersRes = await pool.query(
        `SELECT * FROM team_members WHERE team_id = $1 ORDER BY position`,
        [teamRes.rows[0].id]
      );
      
      // Mappear y setear HP actual al maximo HP basado en estadisticas
      // Aquí fetch a PokeAPI para Stats completas se simula si ya lo guardamos, o hacemos un call dinámico
      // Para optimizar en el backend sin axios extra, podemos asumir que el cliente ya validó 
      // y basarnos en una fórmula que calcule estadísticas a Nivel 50
      
      // Como optimization a corto plazo, vamos a simular 150HP y stats base 100 si no tenemos a mano el valor exacto,
      // Aunque lo correcto es calcular. Las stats de Pokemon al NVL 50 = (Base * 2 + 31) * 50 / 100 + X.
      // Haremos un mock inicial para no bloquear (o el cliente podría pasar las stat sheets validadas por el server).
      
      return membersRes.rows.map(m => {
        let moves = [];
        try { moves = typeof m.moves === 'string' ? JSON.parse(m.moves) : m.moves; } catch(e){}
        
        return {
          id: m.pokemon_id,
          name: m.pokemon_name,
          position: m.position,
          moves: moves || [],
          // Valores fijos para la versión simplificada (podrían venir de base de datos extra)
          hp: 150, maxHp: 150,
          attack: 100, defense: 100,
          spAttack: 100, spDefense: 100,
          speed: Math.floor(Math.random() * 50) + 80, // Aleatorio para ilustrar
          fainted: false
        };
      });
    };

    battle.teams[battle.challengerId] = await fetchTeam(battle.challengerId);
    battle.teams[battle.opponentId] = await fetchTeam(battle.opponentId);

    // Inicializar pokemon activo (primero no debilitado)
    battle.activePokemonIndex[battle.challengerId] = 0;
    battle.activePokemonIndex[battle.opponentId] = 0;
  }

  // "Fórmula Intermedia" y resolución
  resolveTurn(battle) {
    const p1Id = battle.challengerId;
    const p2Id = battle.opponentId;
    const action1 = battle.turnActions[p1Id];
    const action2 = battle.turnActions[p2Id];
    
    // Limpiar acciones para el proximo turno
    battle.turnActions = {};

    let log = [];

    // 1. Manejar "Switch" primero (prioridad máxima)
    const handleSwitch = (userId, action) => {
      if (action.type === 'switch') {
        const pkmn = battle.teams[userId][action.switchIndex];
        if (pkmn && !pkmn.fainted) {
          battle.activePokemonIndex[userId] = action.switchIndex;
          log.push({ player: userId, message: `cambió a ${pkmn.name}` });
        }
      }
    };
    handleSwitch(p1Id, action1);
    handleSwitch(p2Id, action2);

    // 2. Manejar "Ataques" basado en Speed
    const pkmn1 = battle.teams[p1Id][battle.activePokemonIndex[p1Id]];
    const pkmn2 = battle.teams[p2Id][battle.activePokemonIndex[p2Id]];

    // Orden de ataque
    let attackers = [];
    if (action1.type === 'attack' && action2.type === 'attack') {
      if (pkmn1.speed >= pkmn2.speed) attackers = [{id: p1Id, p: pkmn1, tgt: pkmn2, act: action1}, {id: p2Id, p: pkmn2, tgt: pkmn1, act: action2}];
      else attackers = [{id: p2Id, p: pkmn2, tgt: pkmn1, act: action2}, {id: p1Id, p: pkmn1, tgt: pkmn2, act: action1}];
    } else if (action1.type === 'attack') {
      attackers = [{id: p1Id, p: pkmn1, tgt: pkmn2, act: action1}];
    } else if (action2.type === 'attack') {
      attackers = [{id: p2Id, p: pkmn2, tgt: pkmn1, act: action2}];
    }

    for (const atk of attackers) {
      if (atk.p.fainted) continue; // Si se debilitó antes en el mismo turno
      
      const move = atk.p.moves[atk.act.moveIndex];
      // Si el movimiento no existe o power es null, es un ataque base 40
      const power = move?.power || 40; 
      const moveName = move?.name || 'Ataque';
      const moveType = move?.type?.name || 'normal';

      // Formula Intermedia (Nivel 50 Asumido)
      // Modificador de Tipo Básico: asumimos 1.0 para mantenerlo simple sin un mapeo completo de los 18x18 tipos, 
      // pero agregamos STAB (x1.5) si coinciden los tipos hipotéticos (esto requeriría el tipo de atk.p, omitido momentáneamente)
      let modifier = 1.0; 
      // Critical hit chance 1/16 (6.25%)
      const isCrit = Math.random() < 0.0625;
      if (isCrit) modifier *= 1.5;

      const adRatio = (atk.p.attack / atk.tgt.defense);
      let damage = Math.floor(((((2 * 50 / 5 + 2) * power * adRatio) / 50) + 2) * modifier);
      // Randomizer (85 a 100)
      damage = Math.floor(damage * (Math.floor(Math.random() * 16) + 85) / 100);
      
      if (damage < 1) damage = 1;

      atk.tgt.hp -= damage;
      if (atk.tgt.hp < 0) atk.tgt.hp = 0;

      log.push({ 
        player: atk.id, 
        message: `${atk.p.name} usó ${moveName}!`, 
        damage,
        crit: isCrit
      });

      if (atk.tgt.hp === 0) {
        atk.tgt.fainted = true;
        log.push({ player: atk.id, message: `¡${atk.tgt.name} de oponente se debilitó!` });
        
        // Comprobar si termina la partida
        const targetTeam = battle.teams[atk.id === p1Id ? p2Id : p1Id];
        const allFainted = targetTeam.every(p => p.fainted);
        if (allFainted) {
          log.push({ message: 'MATCH_OVER', winner: atk.id });
          this.endBattle(battle.id, atk.id);
          this.io.to(battle.room).emit('turn_result', { log, state: this.getSanitizedState(battle), matchOver: true, winner: atk.id });
          return;
        }
      }
    }

    // Emitir resultados a ambos
    this.io.to(battle.room).emit('turn_result', { log, state: this.getSanitizedState(battle) });
  }

  // Prepara el estado para no filtrar información innecesaria al cliente, aunque por ahora enviamos el equipo
  getSanitizedState(battle) {
    return {
      teams: battle.teams,
      activePokemonIndex: battle.activePokemonIndex,
      challengerId: battle.challengerId,
      opponentId: battle.opponentId
    };
  }

  async endBattle(battleId, winnerId) {
    this.activeBattles.delete(battleId);
    // Podriamos actualizar battle_challenges a status='finished' o sumarle puntos a winnerId
    await pool.query('UPDATE battle_challenges SET status = $1 WHERE id = $2', ['finished', battleId]);
  }
}

module.exports = new BattleEngine();
