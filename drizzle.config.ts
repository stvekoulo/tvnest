import type { Config } from 'drizzle-kit';
import { homedir } from 'os';
import { join } from 'path';

const dbDir = join(homedir(), '.tvnest', 'databases');
const dbPath = join(dbDir, 'tvnest.db');
const dbUrl = `file:${dbPath}`;

export default {
    schema: './libs/shared/database/src/lib/schema.ts',
    out: './apps/electron-backend/src/app/database/migrations',
    dialect: 'sqlite',
    dbCredentials: {
        url: dbUrl,
    },
} satisfies Config;
