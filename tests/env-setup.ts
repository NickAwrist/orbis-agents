import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.AGENTS_DB_PATH = ":memory:";
process.env.NODE_ENV = "test";
process.env.ORBIS_DATA_ROOT = join(tmpdir(), `orbis-test-${process.pid}`);
