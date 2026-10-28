// Confere se as credenciais do bucket de currículos funcionam, sem gravar nada (só lista 1
// objeto). Uso: node scripts/check-storage.mjs [arquivo-env], padrão .env. Para testar os
// valores da Vercel, cole-os em .env.production.local (ignorado pelo git) e passe esse arquivo.
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const envFile = process.argv[2] ?? ".env";
process.loadEnvFile(envFile);

const KEYS = ["STORAGE_ENDPOINT", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY"];
for (const key of KEYS) {
  const value = process.env[key] ?? "";
  const problems = [];
  if (!value) problems.push("vazia");
  if (/^["']|["']$/.test(value)) problems.push("tem aspas");
  if (value !== value.trim()) problems.push("tem espaço nas pontas");
  const shown = key.endsWith("_KEY") ? `${value.length} caracteres` : value;
  console.log(`${key}: ${shown}${problems.length ? `  <-- ${problems.join(", ")}` : ""}`);
}

const client = new S3Client({
  endpoint: process.env.STORAGE_ENDPOINT,
  region: "auto",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "",
    secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "",
  },
});

try {
  await client.send(new ListObjectsV2Command({ Bucket: process.env.STORAGE_BUCKET, MaxKeys: 1 }));
  console.log(`\nOK: o bucket aceitou as credenciais de ${envFile}.`);
} catch (err) {
  console.log(`\nFALHOU: ${err.name}: ${err.message}`);
  process.exitCode = 1;
}
