# Quickstart — Portal de Candidatura (Sprint 1)

Como subir o projeto e provar que a Sprint 1 funciona. Detalhes de domínio estão em
[data-model.md](./data-model.md); os contratos, em [contracts/api.md](./contracts/api.md).

## Pré-requisitos

- Node.js 20+ e pnpm
- Docker (para o Postgres local e para os testes de integração)
- Contas de desenvolvedor: GitHub OAuth App (obrigatório) e LinkedIn (opcional — ver R2)

## Setup

```bash
pnpm install
cp .env.example .env.local        # preencher as variáveis abaixo
docker compose up -d db           # Postgres local
pnpm prisma migrate dev           # cria o schema
pnpm db:seed                      # vagas, etapas e usuários de demonstração
pnpm dev                          # http://localhost:3000
```

### Variáveis de ambiente

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | conexão Postgres |
| `AUTH_SECRET` | assinatura de sessão do Auth.js |
| `ENCRYPTION_KEY` | 32 bytes em base64 — AES-256-GCM dos campos pessoais (R4) |
| `GITHUB_ID` / `GITHUB_SECRET` | OAuth e coleta de portfólio |
| `LINKEDIN_ID` / `LINKEDIN_SECRET` | opcional; ausente desliga o botão do LinkedIn |
| `STORAGE_*` | bucket **privado** de currículos |

Gerar a chave de criptografia: `openssl rand -base64 32`.
Nenhuma dessas variáveis vai para o git.

## Validação manual — os três fluxos P1

**Fluxo 1 — cadastro e papel (User Story 1)**
1. `/cadastro` → criar conta → deve cair em `/vagas`.
2. Sair, entrar com senha errada → erro, sem sessão.
3. Entrar com o usuário `recrutador@3aq.dev` do seed → deve cair em `/recrutamento`, não em `/vagas`.
4. Fechar e reabrir o navegador → continua autenticado.

**Fluxo 2 — perfil (User Story 2)**
1. `/perfil` → preencher telefone e cidade → salvar → recarregar → dados persistem.
2. Anexar um PDF ≤ 5 MB → aceito. Anexar um `.txt` → recusado, currículo anterior intacto.
3. Conectar GitHub → o perfil mostra linguagens e repositórios após a coleta.
4. Conectar um GitHub inexistente → aparece **"Indisponível"** com motivo, e o botão de
   nova tentativa fica disponível. **O candidato continua conseguindo se candidatar.**

**Fluxo 3 — candidatura (User Story 3)**
1. `/vagas` sem estar logado → as 5 vagas do seed aparecem.
2. Filtrar por Remoto + Sênior → a lista reduz; filtro sem resultado mostra a orientação.
3. Tentar se candidatar deslogado → vai ao login e **volta para a mesma vaga**.
4. Candidato sem currículo → bloqueado com a mensagem de completar o perfil.
5. Candidato com currículo → inscrição criada, etapa inicial visível.
6. Candidatar-se de novo à mesma vaga → recusado, com o status atual.

## Verificações que provam os requisitos não-funcionais

| O que verificar | Como | Requisito |
|---|---|---|
| Telefone cifrado em repouso | `SELECT phone FROM "Candidate"` → texto ilegível com prefixo `v1:` | FR-016 |
| Currículo não é público | abrir a URL do storage sem sessão → negado | FR-017 |
| Recrutador vê, estranho não | `GET /api/resumes/{id}/download` com candidato alheio → **403** | FR-017 |
| Score é imutável | `UPDATE "Evaluation" SET score = 100` → exceção da trigger | FR-028 |
| Sem candidatura dupla | disparar dois `POST /apply` em paralelo → 1× 201, 1× 409 | FR-022 / SC-003 |
| Responsivo | DevTools em 360 px e 1280 px, percorrer os 3 fluxos → sem rolagem horizontal | FR-030 / SC-006 |

## Testes automatizados

```bash
pnpm test           # Vitest — unidade + integração (sobe Postgres efêmero)
pnpm test:e2e       # Playwright — os três fluxos P1 em 360px e 1280px
```

Os três testes exigidos pela constituição (R8) são bloqueantes: negação de acesso ao
currículo, update recusado em `Evaluation` e candidatura simultânea. Se algum falhar, a
sprint não está entregue.

## Definition of Done da Sprint 1

- [ ] Os três fluxos P1 completáveis do zero por alguém de fora da equipe
- [ ] Schema migrado com as tabelas 🟡 das Sprints 2 e 3 já criadas
- [ ] Os três testes obrigatórios da constituição passando
- [ ] Nenhuma chave ou segredo versionado
- [ ] Aplicação rodando em ambiente publicado, acessível pelo navegador
