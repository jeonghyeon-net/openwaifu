import { Database } from "bun:sqlite";

export class SessionStore {
	private db: Database;
	private botType: string;

	constructor(dbPath: string, botType: string) {
		this.db = new Database(dbPath);
		this.botType = botType;
		this.db.run(`
			CREATE TABLE IF NOT EXISTS sessions (
				channel_id TEXT PRIMARY KEY,
				session_id TEXT NOT NULL,
				bot_type TEXT NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`);
	}

	get(channelId: string): string | undefined {
		const row = this.db
			.query<{ session_id: string; bot_type: string }, [string]>(
				"SELECT session_id, bot_type FROM sessions WHERE channel_id = ?",
			)
			.get(channelId);
		if (!row || row.bot_type !== this.botType) return undefined;
		return row.session_id;
	}

	set(channelId: string, sessionId: string): void {
		this.db.run(
			`INSERT INTO sessions (channel_id, session_id, bot_type, updated_at)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(channel_id) DO UPDATE SET
			   session_id = excluded.session_id,
			   bot_type = excluded.bot_type,
			   updated_at = excluded.updated_at`,
			[channelId, sessionId, this.botType, Date.now()],
		);
	}

	delete(channelId: string): void {
		this.db.run("DELETE FROM sessions WHERE channel_id = ?", [channelId]);
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
