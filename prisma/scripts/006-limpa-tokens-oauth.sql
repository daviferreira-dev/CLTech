-- Spec 006, NFR-302 / L1 — execução única, não é migração.
--
-- Contas OAuth vinculadas antes da spec 006 guardam access_token, refresh_token e id_token
-- em texto claro. Nenhum código os lê; a partir da 006 o adapter não grava mais
-- (src/server/auth/adapter.ts). Este script limpa as linhas antigas. Idempotente.
--
-- Rodar no SQL Editor do Supabase ou com: psql "$DATABASE_URL" -f prisma/scripts/006-limpa-tokens-oauth.sql

UPDATE "Account"
SET access_token = NULL,
    refresh_token = NULL,
    id_token = NULL,
    expires_at = NULL,
    token_type = NULL,
    scope = NULL,
    session_state = NULL
WHERE access_token IS NOT NULL
   OR refresh_token IS NOT NULL
   OR id_token IS NOT NULL;
