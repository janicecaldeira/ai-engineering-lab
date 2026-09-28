export interface Config {
  databaseUrl: string;
}

export function carregarConfig(): Config {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL nao configurada");
  }
  return { databaseUrl };
}
