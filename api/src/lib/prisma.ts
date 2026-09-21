import { PrismaClient } from '@prisma/client';

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

// Reutiliza la instancia en globalThis durante el desarrollo para que
// `tsx watch` no abra una conexión nueva contra el pooler en cada reinicio.
export const prisma = globalThis.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}
