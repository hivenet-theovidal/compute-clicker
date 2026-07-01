import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'hivenet.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_state (
      player_id TEXT PRIMARY KEY REFERENCES players(id),
      total_earned REAL NOT NULL DEFAULT 0,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attacker_id TEXT NOT NULL REFERENCES players(id),
      target_id   TEXT NOT NULL REFERENCES players(id),
      cost        REAL NOT NULL,
      reduction   REAL NOT NULL DEFAULT 0.3,
      created_at  INTEGER NOT NULL,
      expires_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_attacks_target   ON attacks(target_id, expires_at);
    CREATE INDEX IF NOT EXISTS idx_attacks_cooldown ON attacks(attacker_id, target_id, expires_at);
  `);
}

export interface Player {
  id: string;
  name: string;
  created_at: number;
}

export interface GameStateRow {
  player_id: string;
  total_earned: number;
  state_json: string;
  updated_at: number;
}

export function createPlayer(id: string, name: string): Player {
  const db = getDb();
  const now = Date.now();
  db.prepare('INSERT INTO players (id, name, created_at) VALUES (?, ?, ?)').run(id, name, now);
  return { id, name, created_at: now };
}

export function getPlayer(id: string): Player | null {
  const db = getDb();
  return db.prepare('SELECT * FROM players WHERE id = ?').get(id) as Player | null;
}

export function getGameState(playerId: string): GameStateRow | null {
  const db = getDb();
  return db.prepare('SELECT * FROM game_state WHERE player_id = ?').get(playerId) as GameStateRow | null;
}

export function upsertGameState(playerId: string, totalEarned: number, stateJson: string): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    INSERT INTO game_state (player_id, total_earned, state_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      total_earned = excluded.total_earned,
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `).run(playerId, totalEarned, stateJson, now);
}

export interface LeaderboardEntry {
  player_id: string;
  name: string;
  total_earned: number;
}

export function getLeaderboard(limit = 20): LeaderboardEntry[] {
  const db = getDb();
  return db.prepare(`
    SELECT players.id AS player_id, players.name, game_state.total_earned
    FROM game_state
    JOIN players ON players.id = game_state.player_id
    ORDER BY game_state.total_earned DESC
    LIMIT ?
  `).all(limit) as LeaderboardEntry[];
}

export interface Attack {
  id: number;
  attacker_id: string;
  target_id: string;
  cost: number;
  reduction: number;
  created_at: number;
  expires_at: number;
}

export function createAttack(
  attackerId: string,
  targetId: string,
  cost: number,
  expiresAt: number
): Attack {
  const db = getDb();
  const now = Date.now();
  const result = db.prepare(`
    INSERT INTO attacks (attacker_id, target_id, cost, reduction, created_at, expires_at)
    VALUES (?, ?, ?, 0.3, ?, ?)
  `).run(attackerId, targetId, cost, now, expiresAt);
  return {
    id: result.lastInsertRowid as number,
    attacker_id: attackerId,
    target_id: targetId,
    cost,
    reduction: 0.3,
    created_at: now,
    expires_at: expiresAt,
  };
}

export function getActiveAttacksOn(targetId: string): (Attack & { attacker_name: string })[] {
  const db = getDb();
  const now = Date.now();
  return db.prepare(`
    SELECT a.*, p.name AS attacker_name
    FROM attacks a
    JOIN players p ON p.id = a.attacker_id
    WHERE a.target_id = ? AND a.expires_at > ?
  `).all(targetId, now) as (Attack & { attacker_name: string })[];
}

/** Returns ms remaining on the cooldown, or null if no active attack from attacker on target */
export function getAttackCooldown(attackerId: string, targetId: string): number | null {
  const db = getDb();
  const now = Date.now();
  const row = db.prepare(`
    SELECT expires_at FROM attacks
    WHERE attacker_id = ? AND target_id = ? AND expires_at > ?
    ORDER BY expires_at DESC
    LIMIT 1
  `).get(attackerId, targetId, now) as { expires_at: number } | undefined;
  if (!row) return null;
  return row.expires_at - now;
}

export function getPlayerTotalEarned(playerId: string): number {
  const db = getDb();
  const row = db.prepare(`
    SELECT total_earned FROM game_state WHERE player_id = ?
  `).get(playerId) as { total_earned: number } | undefined;
  return row?.total_earned ?? 0;
}

// ── Dashboard aggregates ──────────────────────────────────────

export interface ComponentTotals {
  cpu: number; ram: number; gpu: number;
  power: number; bandwidth: number; container: number;
}

export interface RegionUnlockCounts {
  uae: number; eu: number; us: number; sea: number; brazil: number;
}

export interface ActiveAttackEntry {
  id: number;
  attacker_name: string;
  target_name: string;
  expires_at: number;
  created_at: number;
}

export interface RecentAttackEntry {
  id: number;
  attacker_name: string;
  target_name: string;
  cost: number;
  created_at: number;
  expires_at: number;
}

export interface DashboardStats {
  playerCount: number;
  globalTotalEarned: number;
  componentTotals: ComponentTotals;
  regionUnlocks: RegionUnlockCounts;
  activeAttacks: ActiveAttackEntry[];
  recentAttacks: RecentAttackEntry[];
  topPlayers: LeaderboardEntry[];
}

export function getDashboardStats(): DashboardStats {
  const db = getDb();
  const now = Date.now();

  // Player count + global total
  const globals = db.prepare(`
    SELECT COUNT(*) AS playerCount, COALESCE(SUM(total_earned), 0) AS globalTotalEarned
    FROM game_state
  `).get() as { playerCount: number; globalTotalEarned: number };

  // Component + region totals — aggregate all state_json in one pass
  const componentTotals: ComponentTotals = { cpu: 0, ram: 0, gpu: 0, power: 0, bandwidth: 0, container: 0 };
  const regionUnlocks: RegionUnlockCounts = { uae: 0, eu: 0, us: 0, sea: 0, brazil: 0 };

  const rows = db.prepare('SELECT state_json FROM game_state').all() as { state_json: string }[];
  for (const row of rows) {
    try {
      const state = JSON.parse(row.state_json) as {
        regions: Record<string, { unlocked: boolean; components: Record<string, number> }>;
      };
      for (const [rid, rs] of Object.entries(state.regions)) {
        if (rs.unlocked && rid in regionUnlocks) {
          regionUnlocks[rid as keyof RegionUnlockCounts]++;
        }
        for (const [ctype, count] of Object.entries(rs.components)) {
          if (ctype in componentTotals) {
            componentTotals[ctype as keyof ComponentTotals] += count as number;
          }
        }
      }
    } catch { /* skip malformed */ }
  }

  // Active attacks with player names
  const activeAttacks = db.prepare(`
    SELECT a.id, a.expires_at, a.created_at,
           p1.name AS attacker_name, p2.name AS target_name
    FROM attacks a
    JOIN players p1 ON p1.id = a.attacker_id
    JOIN players p2 ON p2.id = a.target_id
    WHERE a.expires_at > ?
    ORDER BY a.expires_at ASC
  `).all(now) as ActiveAttackEntry[];

  // Recent attacks (last 10, including expired)
  const recentAttacks = db.prepare(`
    SELECT a.id, a.cost, a.created_at, a.expires_at,
           p1.name AS attacker_name, p2.name AS target_name
    FROM attacks a
    JOIN players p1 ON p1.id = a.attacker_id
    JOIN players p2 ON p2.id = a.target_id
    ORDER BY a.created_at DESC
    LIMIT 12
  `).all() as RecentAttackEntry[];

  const topPlayers = db.prepare(`
    SELECT players.id AS player_id, players.name, game_state.total_earned
    FROM game_state
    JOIN players ON players.id = game_state.player_id
    ORDER BY game_state.total_earned DESC
    LIMIT 10
  `).all() as LeaderboardEntry[];

  return {
    playerCount: globals.playerCount,
    globalTotalEarned: globals.globalTotalEarned,
    componentTotals,
    regionUnlocks,
    activeAttacks,
    recentAttacks,
    topPlayers,
  };
}

/** Returns all active attacks launched by this player, keyed by targetId → expiresAt */
export function getMyCooldowns(attackerId: string): Record<string, number> {
  const db = getDb();
  const now = Date.now();
  const rows = db.prepare(`
    SELECT target_id, MAX(expires_at) as expires_at FROM attacks
    WHERE attacker_id = ? AND expires_at > ?
    GROUP BY target_id
  `).all(attackerId, now) as { target_id: string; expires_at: number }[];
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.target_id] = row.expires_at;
  }
  return result;
}
