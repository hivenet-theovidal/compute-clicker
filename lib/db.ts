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
  name: string;
  total_earned: number;
}

export function getLeaderboard(limit = 20): LeaderboardEntry[] {
  const db = getDb();
  return db.prepare(`
    SELECT players.name, game_state.total_earned
    FROM game_state
    JOIN players ON players.id = game_state.player_id
    ORDER BY game_state.total_earned DESC
    LIMIT ?
  `).all(limit) as LeaderboardEntry[];
}
