# ai — Serviço de inteligência da CLTech

Serviço **Python + FastAPI** responsável pelos dois motores de IA do produto: a triagem de
currículos e a correção automática dos testes de código.

> **Estado:** reservado. O código entra na Sprint 2 (triagem) e na Sprint 3 (correção).
> A pasta existe desde a Sprint 1 para fixar a fronteira entre as camadas.

## Os dois motores

### Módulo de triagem — Sprint 2 (RF02, RF03, RN001, RN002)

Lê o currículo, extrai competências e calcula o score de compatibilidade com a vaga.

```text
currículo (PDF/DOCX)
      │
      ├─► extração de texto
      ├─► identificação de competências
      └─► comparação com Job.technologies + minimumRequirements
              │
              └─► score 0-100 + justificativa (encontradas × exigidas)
```

**É NLP determinístico, não LLM externo.** Essa escolha não é por economia — é por
conformidade:

| Motivo | Consequência |
|---|---|
| A RN003 exige score imutável e reproduzível | Um algoritmo de pesos dá o mesmo resultado para a mesma entrada; um LLM não garante isso |
| O Princípio III exige justificativa rastreável | "Encontrou React e Node, faltou Docker" é auditável; a resposta de um LLM é caixa-preta |
| O Princípio I exige minimizar exposição de dado pessoal | Nenhum currículo sai da infraestrutura do projeto |
| Restrição orçamental da demanda | Custo recorrente zero |

**Requisitos de máquina:** CPU comum, sem GPU. A extração de texto e a comparação de
competências são operações de milissegundos. Não há treinamento pesado — o que o cronograma
chama de "treinamento do modelo" é a calibração dos pesos de cada competência exigida.

### Módulo de avaliação e feedback — Sprint 3 (RF05, RF06, RNF06)

Recebe a submissão de código do candidato, executa contra os casos de teste e produz o
relatório de desempenho.

**A execução acontece em sandbox isolado**, nunca no processo deste serviço. O Princípio IV
da constituição é inegociável:

- sem acesso à rede
- sem acesso ao sistema de arquivos do host
- limite rígido de CPU, memória e **10 segundos** por submissão
- sandbox descartado após cada execução
- tentativa de escapar reprova a submissão por segurança e vai para auditoria

O relatório fica pronto em até 5 minutos após a submissão (RNF03), então o processamento é
assíncrono — o candidato não espera na requisição.

## Estrutura prevista

```text
ai/
├── app/
│   ├── main.py            Aplicação FastAPI
│   ├── triagem/           Extração, competências, score
│   └── avaliacao/         Execução em sandbox, casos de teste, relatório
├── tests/
└── requirements.txt
```

## Como rodar

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload    # http://localhost:8000
```

## Fronteira com o backend

Este serviço **não acessa o banco de dados diretamente** e não conhece candidato, vaga nem
sessão. Ele recebe o que precisa, devolve o resultado, e o backend persiste.

Isso mantém duas garantias: o score é gravado por quem controla a regra de imutabilidade, e
o serviço que executa código de terceiros nunca tem credencial de banco.
