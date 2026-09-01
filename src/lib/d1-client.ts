import { getCloudflareContext } from "@opennextjs/cloudflare";

export type QueryParam = string | number | null;

/**
 * The only module that touches the D1 binding. Everything else goes through these
 * helpers, which is what makes the auth layer mockable in unit tests.
 */
function getDb(): D1Database {
	const { env } = getCloudflareContext();
	return env.DB;
}

export async function queryAll<T>(sql: string, params: QueryParam[] = []): Promise<T[]> {
	const statement = getDb().prepare(sql);
	const bound = params.length > 0 ? statement.bind(...params) : statement;
	const { results } = await bound.all<T>();

	return results ?? [];
}

/**
 * Reads the first row of `all()` rather than using `first()`, which behaves
 * inconsistently between local and remote D1.
 */
export async function queryOne<T>(sql: string, params: QueryParam[] = []): Promise<T | null> {
	const results = await queryAll<T>(sql, params);
	return results[0] ?? null;
}

export async function execute(sql: string, params: QueryParam[] = []): Promise<void> {
	const statement = getDb().prepare(sql);
	const bound = params.length > 0 ? statement.bind(...params) : statement;
	await bound.run();
}
