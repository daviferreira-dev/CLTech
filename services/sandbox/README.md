# sandbox — Judge0 para a correção de código

A correção dos desafios (spec 005, RNF06) roda o código do candidato num **Judge0 CE** em
uma VM separada, nunca na Vercel: função serverless não isola CPU, memória nem rede. O app
só fala HTTP com ele (`src/server/sandbox/index.ts`). Sem `SANDBOX_URL` em produção, toda
execução responde "ambiente de execução indisponível".

Custo zero: VM gratuita + Judge0 open source. O RapidAPI também funciona
(`SANDBOX_URL=https://judge0-ce.p.rapidapi.com`), mas não tem mais plano gratuito.

## 1. Criar a VM gratuita

As imagens do Judge0 são **só x86_64**: escolha processador AMD/Intel, nunca ARM (Ampere).

| Opção | Máquina | Observação |
|---|---|---|
| **Oracle Cloud Always Free** | `VM.Standard.E2.1.Micro` (AMD, 1 GB) + Ubuntu 22.04 | Grátis para sempre. Pede cartão só para verificar identidade, sem cobrança. 1 GB é justo: o script cria swap. |
| **Azure for Students** (GitHub Student Pack) | `B1s` ou `B2s` + Ubuntu 22.04 | US$ 100 de crédito, **sem cartão**. Mais memória, mas o crédito acaba. |

Na criação, gere/baixe a chave SSH e anote o **IP público**.

### Liberar a porta 2358

- **Oracle:** Networking → Virtual Cloud Networks → sua VCN → Security Lists → Default →
  *Add Ingress Rule*: origem `0.0.0.0/0`, TCP, porta de destino `2358`.
- **Azure:** VM → Networking → *Add inbound port rule*: TCP `2358`.

## 2. Instalar o Judge0

Copie o script para a VM e rode **duas vezes** (a primeira reinicia a VM para ligar o cgroup v1,
que o Judge0 1.13 exige):

```bash
scp -i chave.key services/sandbox/setup-judge0.sh ubuntu@IP-DA-VM:~
ssh -i chave.key ubuntu@IP-DA-VM
sudo bash setup-judge0.sh     # reinicia a VM
# espere ~1 min, entre de novo por ssh
sudo bash setup-judge0.sh     # instala e sobe o Judge0
```

No fim ele imprime o `SANDBOX_URL` e o `SANDBOX_TOKEN`.

## 3. Ligar no app

Na Vercel (Settings → Environment Variables, ambiente Production, sem aspas):

```
SANDBOX_URL=http://IP-DA-VM:2358
SANDBOX_TOKEN=<token impresso pelo script>
```

Depois, **Redeploy**. Para testar antes, coloque os mesmos valores no `.env` local.

## Conferir se está no ar

```bash
curl -s -X POST "http://IP-DA-VM:2358/submissions?wait=true" \
  -H "Content-Type: application/json" -H "X-Auth-Token: SEU_TOKEN" \
  -d '{"language_id":71,"source_code":"print(input().upper())","stdin":"ola"}'
```

Resposta esperada: `"stdout":"OLA\n"` e `"status":{"id":3,"description":"Accepted"}`.

- `401`: token errado.
- Sem resposta: porta 2358 fechada (regra da nuvem ou `iptables` da VM).
- `"Internal Error"` em toda execução: o cgroup v1 não ligou (`ls /sys/fs/cgroup/cgroup.controllers`
  não deve existir); rode o script de novo.

## Limites

- O tráfego é HTTP puro, protegido só pelo token. Suficiente para o projeto acadêmico; para
  produção de verdade, ponha um proxy HTTPS (ex.: Caddy) na frente.
- Se a VM cair, a tela volta a mostrar "ambiente indisponível" e nada se perde: o rascunho
  fica salvo e as submissões pendentes são corrigidas quando o sandbox voltar.
