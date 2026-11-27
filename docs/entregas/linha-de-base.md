# Linha de base: referência de mercado e estudo de esforço

**Projeto:** CLTech — portal de recrutamento técnico para a 3aq Tecnologia  
**Data:** 11/11/2026 · **Versão:** 1.0  
**Responsável pela consolidação:** Cassiano Luiz Brandes Soares  
**Rastreabilidade:** [spec 010, D2 e FR-1008](../../specs/010-velocidade-indicadores/spec.md) e [divisão da equipe de 07/11](../../specs/DIVISAO-EQUIPE.md).

## 1. Objetivo e situação da evidência

A demanda da 3aq propõe diminuir em pelo menos 50% o tempo entre o anúncio da vaga e a proposta final. As dores associadas são a leitura manual de currículos pelo RH e a interrupção do trabalho de profissionais sêniores para corrigir testes técnicos.

Este documento organiza duas evidências distintas:

| Evidência | O que permite avaliar | Situação em 11/11/2026 |
|---|---|---|
| Referência de mercado | Comparar o tempo observado no CLTech com um parâmetro externo de contratação em tecnologia | Fonte consultada e referência de 45 dias definida neste documento |
| Estudo de esforço da equipe | Comparar o trabalho humano de triagem e correção manual com o trabalho assistido pelo CLTech | Protocolo definido; execução por duas pessoas e medições pendentes |

Não há série histórica da 3aq disponível para esta entrega. Assim, a referência externa não representa o tempo atual da empresa, e o estudo acadêmico não comprova redução do prazo de contratações reais. Os campos pendentes abaixo não representam tempo zero.

## 2. Referência de mercado

### 2.1. Fonte e dado utilizado

A pesquisa **“Mercado de Trabalho Tech: Raio-X e Tendências”**, realizada pela Ford em parceria com o Datafolha, ouviu 250 lideranças de RH e TI de médias e grandes empresas de diferentes setores e regiões do Brasil, conforme a [divulgação da AutoData, de 24/04/2026](https://www.autodata.com.br/noticias/2026/04/24/98-das-empresas-relatam-dificuldade-para-contratar-profissionais-em-tecnologia/102610/). O próprio [Datafolha divulgou a pesquisa e o tamanho da amostra](https://pt.linkedin.com/posts/datafolha_quase-todas-as-empresas-do-brasil-98-t%C3%AAm-activity-7453457072597381120-pChm).

O dado adotado é que **50% das empresas levam entre um e dois meses para preencher posições de tecnologia**. A informação também consta na [publicação do CREA-RJ de 25/05/2026](https://www.crea-rj.org.br/pesquisa-ford-datafolha-aponta-dificuldade-de-contratacao-de-profissionais-de-tecnologia-no-brasil/). **Data de acesso às fontes: 11/11/2026.**

As publicações consultadas apresentam uma distribuição por faixas; não fornecem uma média nacional exata de dias. Não foi utilizado um relatório metodológico integral para validar o marco inicial e final de cada contratação.

### 2.2. Conversão em parâmetro

Para obter um único valor de comparação, adota-se o ponto médio da faixa de um a dois meses, considerando, por convenção, 30 dias por mês:

```text
Limite inferior = 1 × 30 = 30 dias
Limite superior = 2 × 30 = 60 dias
Referência = (30 + 60) / 2 = 45 dias corridos
Metade da referência = 45 × 0,5 = 22,5 dias corridos
```

**45 dias é uma aproximação escolhida pela equipe, derivada da faixa publicada; não é uma média calculada pelo Datafolha.** A faixa original de 30 a 60 dias deve acompanhar a interpretação: sua metade vai de 15 a 30 dias.

Configuração proposta para o painel, sem alterar ambientes nesta entrega:

```dotenv
HIRING_BASELINE_DAYS=45
HIRING_BASELINE_LABEL="Referência de mercado · Ford/Datafolha 2026 (ponto médio)"
```

### 2.3. Métrica do CLTech e interpretação

Conforme a spec 010, o CLTech mede, por vaga, os dias corridos entre a publicação e a primeira entrada de uma candidatura na etapa **Proposta Final**. Quando essa etapa não existe, utiliza a primeira aprovação como aproximação. A média considera apenas vagas publicadas que alcançaram esse marco, com a quantidade de vagas exibida junto ao resultado. O filtro de período considera a data de publicação da vaga.

```text
Dias da vaga = (data do primeiro marco final − data de publicação) / 86.400.000 ms
Tempo médio = soma dos dias das vagas elegíveis / quantidade de vagas elegíveis
Percentual abaixo da referência = (1 − tempo médio / 45) × 100
```

Sem vaga elegível, não existe média calculável. Sem referência configurada, o painel pode informar o tempo observado, mas não um percentual comparativo. Percentual negativo significa tempo acima da referência.

A contagem iniciada na abertura/publicação aproxima-se do conceito de *time to fill*, diferentemente de uma contagem iniciada na entrada do candidato (*time to hire*). Entretanto, **chegar à proposta não equivale a preencher a vaga**: a proposta pode ser recusada e a contratação pode ocorrer depois. A referência publicada e o indicador local têm marcos finais distintos.

O painel deve usar expressões como **“abaixo da referência”** e **“metade ou menos da referência”**. Atingir 22,5 dias neste comparativo não autoriza afirmar “meta da 3aq atingida”.

### 2.4. Limitações da comparação

- A amostra é de médias e grandes empresas; não é um levantamento específico da 3aq, situada no Ceará, conforme o contexto da spec 010.
- Porte, senioridade das vagas, região, remuneração e etapas podem alterar o prazo de seleção.
- O ponto médio de uma faixa não representa a média de todas as empresas entrevistadas.
- A fonte trata de preenchimento da vaga; o CLTech acompanha chegada à proposta ou, na ausência dessa etapa, aprovação.
- Vagas ainda sem proposta ficam fora da média; informar sua quantidade separadamente ajuda a evidenciar processos demorados ainda abertos.
- Dados de demonstração ou testes validam o cálculo e a apresentação, mas não demonstram desempenho operacional da 3aq.

## 3. Estudo de esforço da equipe

### 3.1. Pergunta e desenho do estudo

**Pergunta:** quanto trabalho humano é necessário para avaliar o mesmo lote de 20 currículos e cinco soluções de teste de código manualmente e com apoio do CLTech, mantendo critérios e verificando a concordância das avaliações?

O estudo será executado por **duas pessoas da equipe**. Cada participante avaliará o lote completo manualmente e depois com o CLTech, registrando seus tempos separadamente. Trata-se de um estudo descritivo acadêmico, com amostra pequena e por conveniência; os participantes não serão apresentados como recrutadores ou sêniores da 3aq.

### 3.2. Materiais e critérios fixados antes da execução

| Material | Preparação necessária |
|---|---|
| Uma vaga de referência | Fixar tecnologias, requisitos obrigatórios/desejáveis e regra de pontuação antes das avaliações |
| 20 currículos, C01–C20 | Usar dados fictícios e documentos legíveis no formato aceito pelo sistema; registrar a presença/ausência dos requisitos |
| Cinco soluções, T01–T05 | Usar um desafio com enunciado, linguagem, limites e casos de teste fixos; incluir soluções corretas, incorretas e casos de borda |
| Gabarito | Preparar resultados esperados por currículo e por caso de teste, com revisão pelas duas pessoas antes da rodada cronometrada |
| Ambiente | Registrar versão/commit do CLTech, navegador, máquina, modo do sandbox e condições de rede |
| Evidências | Guardar planilha de tempos, manifesto do lote, critérios, resultados e relatórios sem dados pessoais reais |

O gabarito ficará separado durante as avaliações. Se a pontuação manual não reproduzir a regra do CLTech, comparar a presença/ausência dos requisitos e as decisões correspondentes, sem tratar notas de escalas diferentes como equivalentes.

O teste assistido de código depende de um sandbox isolado operacional. Execução simulada ou modo local sem isolamento deve ser identificada e não serve como evidência de desempenho do sandbox em produção.

### 3.3. Protocolo de execução

1. Registrar participantes, data, ambiente, identificadores dos materiais e versão da regra. Fazer treinamento com exemplos fora do lote, sem incluí-lo na medição.
2. Medir separadamente a preparação: configurar vaga, desafio, casos de teste e carregar os documentos. Não incorporar esse custo silenciosamente ao tempo de avaliação nem omiti-lo da análise total.
3. Na rodada manual, cada pessoa lê C01–C20, registra critérios encontrados e conclui a triagem. Depois inspeciona e executa T01–T05 com os mesmos casos fixados, registrando acertos e conclusão. Pode usar editor e executor convencional, sem relatórios automáticos do CLTech.
4. Na rodada assistida, cada pessoa avalia os mesmos itens em ordem embaralhada. Incluir o processamento automático, a consulta ao perfil/score, a leitura dos relatórios e a revisão humana necessária para concluir a avaliação. Impedir acesso às anotações manuais durante a rodada.
5. Cronometrar cada item desde a abertura até o registro da conclusão. Registrar separadamente trabalho humano ativo, espera automática sem intervenção e duração total de relógio. Se houver processamento paralelo, medir o lote pelo início e fim reais; não somar esperas simultâneas como tempo total do lote.
6. Registrar pausas, falhas, tentativas adicionais e correções. Tempo de diagnóstico e retrabalho faz parte do esforço ativo; interrupções externas ficam anotadas e descontadas de maneira explícita. Não descartar execuções lentas sem justificativa.
7. Após as rodadas, comparar resultados manual, assistido e gabarito. Registrar divergências e o tempo para resolvê-las, antes de calcular o ganho líquido.
8. Consolidar resultados por participante e tipo de tarefa, anexar evidências e revisar o documento com a segunda pessoa.

A ordem manual → CLTech atende ao plano da equipe, mas favorece familiaridade com o lote na segunda rodada. Embaralhar itens e separar sessões reduz esse efeito sem eliminá-lo; registrar o intervalo entre sessões. Uma replicação futura pode inverter a ordem para parte dos participantes.

### 3.4. Registro da execução

| Campo | Valor |
|---|---|
| Participante A e experiência com recrutamento/código | Pendente |
| Participante B e experiência com recrutamento/código | Pendente |
| Data, horários e intervalo entre sessões | Pendente |
| Identificação da vaga, rubrica e desafio | Pendente |
| Manifesto C01–C20 e T01–T05 | Pendente |
| Commit do CLTech e ambiente/sandbox | Pendente |
| Preparação manual e preparação do CLTech, em minutos-pessoa | Pendente |
| Caminho das evidências e revisão da segunda pessoa | Pendente |

Usar uma linha por item, participante e método na planilha de evidências: **100 registros esperados** (25 itens × duas pessoas × dois métodos).

```text
participante;metodo;item;inicio;fim;ativo_s;espera_s;pausa_externa_s;resultado;gabarito;divergencia;retrabalho_s;observacoes
```

`ativo_s` deve incluir o retrabalho; `retrabalho_s` é seu detalhamento e não deve ser somado novamente. Registrar os horários do lote separadamente para calcular a duração com atividades em paralelo.

### 3.5. Resultados a preencher após a medição

Todos os tempos da tabela são de **trabalho humano ativo, em minutos-pessoa**, incluindo revisão e retrabalho. Não foram produzidas medições nesta versão.

| Participante | Tarefa | Quantidade por método | Manual | CLTech | Economia | Redução |
|---|---|---:|---|---|---|---|
| A | Triagem de currículos | 20 | Pendente | Pendente | Pendente | Pendente |
| B | Triagem de currículos | 20 | Pendente | Pendente | Pendente | Pendente |
| A | Correção de soluções | 5 | Pendente | Pendente | Pendente | Pendente |
| B | Correção de soluções | 5 | Pendente | Pendente | Pendente | Pendente |

```text
Economia por tarefa = tempo manual ativo − tempo assistido ativo
Redução de esforço (%) = (1 − tempo assistido ativo / tempo manual ativo) × 100
Esforço total por método = preparação + avaliação ativa, incluindo revisão e retrabalho
```

Calcular somente quando o tempo manual for maior que zero. Valor negativo indica aumento de esforço. Apresentar os resultados individuais e os totais; a redução conjunta é calculada a partir da soma dos tempos, e não da média simples dos percentuais. Reportar espera automática e duração de relógio em colunas separadas na evidência.

As duas pessoas repetem o lote para permitir comparação entre avaliadores: a soma de seus tempos corresponde a **duas avaliações do mesmo lote**, não ao custo obrigatório de um processo com um único avaliador.

| Verificação da qualidade | Resultado |
|---|---|
| Currículos: concordância manual × assistido por participante, em itens/20 | Pendente |
| Currículos: concordância de cada método com o gabarito, em itens/20 | Pendente |
| Código: concordância manual × assistido por participante, em soluções/5 | Pendente |
| Código: acerto de cada método por caso de teste e solução | Pendente |
| Divergências entre participantes, causas e retrabalho | Pendente |

Para comparar a triagem, considerar concordância somente quando os critérios fixados produzirem o mesmo resultado por item. Para código, comparar também cada caso de teste; uma nota final igual pode esconder erros diferentes. Divergência em critério obrigatório ou caso crítico exige revisão, mesmo quando houver economia de tempo.

### 3.6. Limites e conclusão permitida

O estudo mede esforço de avaliação em ambiente acadêmico. Não inclui espera por candidatos, entrevistas, negociação, aceite de proposta ou disponibilidade dos decisores. Familiaridade com o software, aprendizagem entre rodadas, tamanho do lote e condições do sandbox afetam os resultados.

Depois da execução, a conclusão deve informar quantidade de itens, participantes, tempos, concordância e limitações. Uma redução de esforço não implica a mesma redução em dias de contratação. Até o preenchimento das evidências, **não há percentual de economia comprovado pelo estudo**.

## 4. Critérios para concluir a entrega

- [x] Identificar fonte externa, data de acesso e limites de aplicação.
- [x] Justificar a escolha de 45 dias e a metade de 22,5 dias.
- [x] Separar referência de mercado, tempo de calendário e esforço humano.
- [x] Definir lote, protocolo, fórmulas e registro de concordância.
- [ ] Executar as duas rodadas com duas pessoas, 20 currículos e cinco soluções.
- [ ] Anexar registros brutos, ambiente, tempos de preparação e resultados por método.
- [ ] Revisar divergências e preencher a conclusão com os valores medidos.

**Situação final desta versão:** referência de mercado documentada; estudo de esforço preparado para execução. A meta de redução de 50% da 3aq permanece sem comprovação empírica.
