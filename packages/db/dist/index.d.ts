import postgres from "postgres";
import * as schema from "./schema";
export declare const db: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
    $client: postgres.Sql<{}>;
};
export * from "drizzle-orm";
export * from "./schema";
//# sourceMappingURL=index.d.ts.map