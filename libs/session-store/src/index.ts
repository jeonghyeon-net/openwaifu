import { Database } from "bun:sqlite";

export class SessionStore {
	private db: Database;
	private botType: string;

	constructor(dbPath: string, botType: string) {
		this.db = new Database(dbPath);
		this.db.run("PRAGMA journal_mode=WAL");
		this.db.run("PRAGMA busy_timeout=5000");
		this.botType = botType;
		this.db.run(`
			CREATE TABLE IF NOT EXISTS sessions (
				channel_id TEXT NOT NULL,
				session_id TEXT NOT NULL,
				bot_type TEXT NOT NULL,
				updated_at INTEGER NOT NULL,
				PRIMARY KEY (channel_id, bot_type)
			)
		`);
	}

	get(channelId: string): string | undefined {
		const row = this.db
			.query<{ session_id: string }, [string, string]>(
				"SELECT session_id FROM sessions WHERE channel_id = ? AND bot_type = ?",
			)
			.get(channelId, this.botType);
		if (!row) return undefined;
		return row.session_id;
	}

	set(channelId: string, sessionId: string): void {
		this.db.run(
			`INSERT INTO sessions (channel_id, session_id, bot_type, updated_at)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(channel_id, bot_type) DO UPDATE SET
			   session_id = excluded.session_id,
			   updated_at = excluded.updated_at`,
			[channelId, sessionId, this.botType, Date.now()],
		);
	}

	delete(channelId: string): void {
		this.db.run("DELETE FROM sessions WHERE channel_id = ? AND bot_type = ?", [
			channelId,
			this.botType,
		]);
	}

	all(): Array<{ channelId: string; sessionId: string }> {
		return this.db
			.query<{ channel_id: string; session_id: string }, [string]>(
				"SELECT channel_id, session_id FROM sessions WHERE bot_type = ? ORDER BY updated_at DESC",
			)
			.all(this.botType)
			.map((row) => ({
				channelId: row.channel_id,
				sessionId: row.session_id,
			}));
	}

	close(): void {
		this.db.close();
	}
}
