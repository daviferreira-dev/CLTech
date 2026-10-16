@echo off
setlocal

if not exist .env (
    echo Criando .env a partir de .env.example...
    copy .env.example .env
)

if not exist node_modules (
    echo Instalando dependencias...
    call pnpm install
)

call pnpm prisma generate
call pnpm build && pnpm start

endlocal
