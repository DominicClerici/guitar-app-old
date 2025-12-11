"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersTable = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const authSchema = (0, pg_core_1.pgSchema)("auth");
exports.users = authSchema.table("users", {
    id: (0, pg_core_1.uuid)("id").primaryKey(),
});
exports.usersTable = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.uuid)("id")
        .primaryKey()
        .references(() => exports.users.id, { onDelete: "cascade" })
        .notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    name: (0, pg_core_1.text)("name").notNull(),
});
//# sourceMappingURL=users-schema.js.map