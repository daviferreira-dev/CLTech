@echo off
setlocal

if not exist .env (
    echo Criando .env a partir de .env.example...
    copy .env.example .env
)

if not exist node_modules (
    echo Instalando dependencias...
    call pnpm install || goto :erro
)

rem Confere o .env antes de tudo: sem isso a aplicacao sobe e quebra no login/upload.
node scripts\check-env.mjs || goto :erro

call pnpm prisma generate || goto :erro
rem Aplica migracoes pendentes e o seed (idempotente: rodar de novo nao duplica nada).
call pnpm prisma migrate deploy || goto :erro
call pnpm db:seed || goto :erro
call pnpm build || goto :erro
rem Com SANDBOX_URL="local" no .env, o teste de codigo roda direto nesta maquina (sem isolamento).
rem O build e de producao, entao a liberacao precisa ser explicita.
set SANDBOX_ALLOW_LOCAL=1
call pnpm start
goto :fim

:erro
echo.
echo Falhou. Corrija o problema acima e rode run.bat de novo.
pause
exit /b 1

:fim
endlocal
