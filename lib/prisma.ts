import "dotenv/config";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function createClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
  });
  // Adapter and root pg types may come from different transitive versions.
  const adapter = new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0]);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as { _prisma?: PrismaClient };
if (!globalForPrisma._prisma) {
  globalForPrisma._prisma = createClient();
}

export const prisma = globalForPrisma._prisma;
export function getPrisma() {
  return globalForPrisma._prisma!;
}
export default prisma;
