import postgres from "postgres";
import * as schema from "./schema";
export declare const db: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
    $client: postgres.Sql<{}>;
};
export * from "./schema";
export * from "drizzle-orm";
//# sourceMappingURL=index.d.ts.map