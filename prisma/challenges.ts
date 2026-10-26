// Spec 005 US4: catálogo de desafios do seed. Cada desafio lê da entrada padrão e escreve na
// saída padrão; casos `hidden` nunca saem do servidor.
//
// Casos grandes dos desafios difíceis são gerados aqui (gerador determinístico + solução de
// referência), para barrar força bruta sem colar centenas de KB no arquivo. A saída esperada
// foi conferida contra soluções independentes em Python.

type Difficulty = "EASY" | "MID" | "HARD";

interface TestCase {
  input: string;
  expectedOutput: string;
  hidden: boolean;
}

export interface ChallengeSeed {
  title: string;
  statement: string;
  languages: string[];
  difficulty: Difficulty;
  timeLimitSeconds: number;
  testCases: TestCase[];
}

const ALL_LANGUAGES = ["python", "javascript", "typescript", "java", "cpp", "go"];

/** Gerador linear congruente: mesma sequência em toda execução do seed. */
function lcg(seed: number) {
  let state = seed >>> 0;
  return (max: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % max;
  };
}

// ---------------------------------------------------------------- referências (casos grandes)

// `!` nos acessos: índices sempre dentro dos limites (projeto usa noUncheckedIndexedAccess).

function lisLength(values: number[]): number {
  const tails: number[] = [];
  for (const v of values) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid]! < v) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = v;
  }
  return tails.length;
}

const STEPS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function gridShortestPath(grid: string[]): number {
  const rows = grid.length;
  const cols = grid[0]!.length;
  const open = (r: number, c: number) => grid[r]![c] !== "#";
  if (!open(0, 0) || !open(rows - 1, cols - 1)) return -1;
  const dist = new Array<number>(rows * cols).fill(-1);
  const queue: number[] = [0];
  dist[0] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    const r = Math.floor(cell / cols);
    const c = cell % cols;
    for (const [dr, dc] of STEPS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || !open(nr, nc)) continue;
      const next = nr * cols + nc;
      if (dist[next] !== -1) continue;
      dist[next] = dist[cell]! + 1;
      queue.push(next);
    }
  }
  return dist[rows * cols - 1]!;
}

function knapsack(capacity: number, items: Array<[number, number]>): number {
  const best = new Array<number>(capacity + 1).fill(0);
  for (const [weight, value] of items) {
    for (let w = capacity; w >= weight; w--) best[w] = Math.max(best[w]!, best[w - weight]! + value);
  }
  return best[capacity]!;
}

function dijkstra(n: number, edges: Array<[number, number, number]>): number {
  const adjacency: Array<Array<[number, number]>> = Array.from({ length: n + 1 }, () => []);
  for (const [u, v, w] of edges) {
    adjacency[u]!.push([v, w]);
    adjacency[v]!.push([u, w]);
  }
  const dist = new Array<number>(n + 1).fill(Infinity);
  dist[1] = 0;
  // Heap binário mínimo de [distância, vértice].
  const heap: Array<[number, number]> = [[0, 1]];
  const less = (i: number, j: number) => heap[i]![0] < heap[j]![0];
  const swap = (i: number, j: number) => {
    const tmp = heap[i]!;
    heap[i] = heap[j]!;
    heap[j] = tmp;
  };
  const push = (item: [number, number]) => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0 && less(i, (i - 1) >> 1); i = (i - 1) >> 1) swap(i, (i - 1) >> 1);
  };
  const pop = (): [number, number] => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < heap.length && less(l, smallest)) smallest = l;
        if (r < heap.length && less(r, smallest)) smallest = r;
        if (smallest === i) break;
        swap(smallest, i);
        i = smallest;
      }
    }
    return top;
  };
  while (heap.length > 0) {
    const [d, u] = pop();
    if (d > dist[u]!) continue;
    for (const [v, w] of adjacency[u]!) {
      if (d + w < dist[v]!) {
        dist[v] = d + w;
        push([d + w, v]);
      }
    }
  }
  return dist[n] === Infinity ? -1 : dist[n]!;
}

// ---------------------------------------------------------------- geradores de casos grandes

function bigLisCase(): TestCase {
  const rand = lcg(42);
  const values = Array.from({ length: 30_000 }, () => rand(1_000_000));
  return { input: `${values.length}\n${values.join(" ")}\n`, expectedOutput: String(lisLength(values)), hidden: true };
}

function bigGridCase(): TestCase {
  const rand = lcg(7);
  const rows = 400;
  const cols = 400;
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ((r === 0 && c === 0) || (r === rows - 1 && c === cols - 1) || rand(100) >= 20 ? "." : "#")).join(""),
  );
  return { input: `${rows} ${cols}\n${grid.join("\n")}\n`, expectedOutput: String(gridShortestPath(grid)), hidden: true };
}

function bigKnapsackCase(): TestCase {
  const rand = lcg(2024);
  const capacity = 10_000;
  const items = Array.from({ length: 200 }, (): [number, number] => [1 + rand(1_000), 1 + rand(10_000)]);
  return {
    input: `${items.length} ${capacity}\n${items.map(([w, v]) => `${w} ${v}`).join("\n")}\n`,
    expectedOutput: String(knapsack(capacity, items)),
    hidden: true,
  };
}

function bigGraphCase(): TestCase {
  const rand = lcg(99);
  const n = 10_000;
  const edges: Array<[number, number, number]> = [];
  // Caminho aleatório garante conexidade; as demais arestas criam atalhos.
  for (let v = 2; v <= n; v++) edges.push([1 + rand(v - 1), v, 1 + rand(1_000)]);
  for (let i = 0; i < 20_000; i++) edges.push([1 + rand(n), 1 + rand(n), 1 + rand(1_000)]);
  return {
    input: `${n} ${edges.length}\n${edges.map((e) => e.join(" ")).join("\n")}\n`,
    expectedOutput: String(dijkstra(n, edges)),
    hidden: true,
  };
}

// ---------------------------------------------------------------- catálogo

export const CHALLENGES: ChallengeSeed[] = [
  // ------------------------------------------------------------ fáceis
  {
    title: "Soma de inteiros",
    statement:
      "Leia uma linha com inteiros separados por espaço e imprima a soma deles.\n\nEntrada: uma linha, por exemplo `1 2 3`.\nSaída: um único inteiro, por exemplo `6`.",
    languages: ALL_LANGUAGES,
    difficulty: "EASY",
    timeLimitSeconds: 5,
    testCases: [
      { input: "1 2 3\n", expectedOutput: "6", hidden: false },
      { input: "10 -4\n", expectedOutput: "6", hidden: false },
      { input: "0\n", expectedOutput: "0", hidden: true },
      { input: "1000000 2000000 3000000\n", expectedOutput: "6000000", hidden: true },
    ],
  },
  {
    title: "Maior e menor",
    statement:
      "Leia uma linha com inteiros separados por espaço e imprima o maior e o menor deles, separados por espaço.\n\nEntrada: uma linha, por exemplo `4 -2 9 7`.\nSaída: `9 -2`.",
    languages: ALL_LANGUAGES,
    difficulty: "EASY",
    timeLimitSeconds: 5,
    testCases: [
      { input: "4 -2 9 7\n", expectedOutput: "9 -2", hidden: false },
      { input: "5\n", expectedOutput: "5 5", hidden: false },
      { input: "-1 -8 -3\n", expectedOutput: "-1 -8", hidden: true },
      { input: "1000000000 -1000000000 0\n", expectedOutput: "1000000000 -1000000000", hidden: true },
    ],
  },
  {
    title: "Contar vogais",
    statement:
      "Leia uma linha de texto (sem acentos) e imprima quantas vogais (`a`, `e`, `i`, `o`, `u`, maiúsculas ou minúsculas) ela tem.\n\nEntrada: uma linha, por exemplo `Ola Mundo`.\nSaída: `4`.",
    languages: ALL_LANGUAGES,
    difficulty: "EASY",
    timeLimitSeconds: 5,
    testCases: [
      { input: "Ola Mundo\n", expectedOutput: "4", hidden: false },
      { input: "xyz\n", expectedOutput: "0", hidden: false },
      { input: "AEIOU aeiou\n", expectedOutput: "10", hidden: true },
      { input: "Programacao em Python e divertida\n", expectedOutput: "12", hidden: true },
    ],
  },
  {
    title: "FizzBuzz",
    statement:
      "Leia um inteiro `N` e imprima os números de 1 a `N`, um por linha, trocando múltiplos de 3 por `Fizz`, múltiplos de 5 por `Buzz` e múltiplos de 3 e 5 por `FizzBuzz`.\n\nEntrada: `5`.\nSaída:\n```\n1\n2\nFizz\n4\nBuzz\n```",
    languages: ALL_LANGUAGES,
    difficulty: "EASY",
    timeLimitSeconds: 5,
    testCases: [
      { input: "5\n", expectedOutput: "1\n2\nFizz\n4\nBuzz", hidden: false },
      { input: "1\n", expectedOutput: "1", hidden: false },
      { input: "15\n", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz", hidden: true },
      {
        input: "30\n",
        expectedOutput:
          "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n16\n17\nFizz\n19\nBuzz\nFizz\n22\n23\nFizz\nBuzz\n26\nFizz\n28\n29\nFizzBuzz",
        hidden: true,
      },
    ],
  },

  // ------------------------------------------------------------ médios
  {
    title: "Palíndromo",
    statement:
      "Leia uma palavra e imprima `SIM` se ela for um palíndromo (ignorando maiúsculas/minúsculas) ou `NAO` caso contrário.",
    languages: ALL_LANGUAGES,
    difficulty: "MID",
    timeLimitSeconds: 5,
    testCases: [
      { input: "arara\n", expectedOutput: "SIM", hidden: false },
      { input: "react\n", expectedOutput: "NAO", hidden: false },
      { input: "Ana\n", expectedOutput: "SIM", hidden: true },
      { input: "ab\n", expectedOutput: "NAO", hidden: true },
    ],
  },
  {
    title: "Anagramas",
    statement:
      "Leia duas palavras, uma por linha, e imprima `SIM` se uma for anagrama da outra (mesmas letras nas mesmas quantidades, ignorando maiúsculas/minúsculas) ou `NAO` caso contrário.\n\nEntrada:\n```\nRoma\namor\n```\nSaída: `SIM`.",
    languages: ALL_LANGUAGES,
    difficulty: "MID",
    timeLimitSeconds: 5,
    testCases: [
      { input: "Roma\namor\n", expectedOutput: "SIM", hidden: false },
      { input: "casa\ncaso\n", expectedOutput: "NAO", hidden: false },
      { input: "aab\nabb\n", expectedOutput: "NAO", hidden: true },
      { input: "Listen\nSilent\n", expectedOutput: "SIM", hidden: true },
      { input: "abc\nabcd\n", expectedOutput: "NAO", hidden: true },
    ],
  },
  {
    title: "Parênteses balanceados",
    statement:
      "Leia uma linha contendo apenas os caracteres `()[]{}` e imprima `SIM` se todos estiverem corretamente abertos e fechados, na ordem certa, ou `NAO` caso contrário. Uma linha vazia é balanceada.\n\nEntrada: `([]{})`.\nSaída: `SIM`.",
    languages: ALL_LANGUAGES,
    difficulty: "MID",
    timeLimitSeconds: 5,
    testCases: [
      { input: "([]{})\n", expectedOutput: "SIM", hidden: false },
      { input: "([)]\n", expectedOutput: "NAO", hidden: false },
      { input: "((((\n", expectedOutput: "NAO", hidden: true },
      { input: "{[()()]}[]\n", expectedOutput: "SIM", hidden: true },
      { input: "())(\n", expectedOutput: "NAO", hidden: true },
      { input: "\n", expectedOutput: "SIM", hidden: true },
    ],
  },
  {
    title: "Palavra mais frequente",
    statement:
      "Leia uma linha de texto com palavras em minúsculas separadas por espaço e imprima a palavra que mais aparece e quantas vezes, separadas por espaço. Em caso de empate, imprima a que vem primeiro em ordem alfabética.\n\nEntrada: `o rato roeu o queijo`.\nSaída: `o 2`.",
    languages: ALL_LANGUAGES,
    difficulty: "MID",
    timeLimitSeconds: 5,
    testCases: [
      { input: "o rato roeu o queijo\n", expectedOutput: "o 2", hidden: false },
      { input: "banana maca\n", expectedOutput: "banana 1", hidden: false },
      { input: "b a b a c\n", expectedOutput: "a 2", hidden: true },
      { input: "dev dev dev ops ops\n", expectedOutput: "dev 3", hidden: true },
    ],
  },

  // ------------------------------------------------------------ difíceis
  {
    title: "Maior subsequência crescente",
    statement:
      "Leia `N` e depois `N` inteiros. Imprima o tamanho da maior subsequência estritamente crescente (os elementos não precisam ser consecutivos).\n\n`N` chega a 30.000: soluções O(N²) estouram o tempo — use O(N log N).\n\nEntrada:\n```\n8\n10 9 2 5 3 7 101 18\n```\nSaída: `4` (por exemplo `2 3 7 18`).",
    languages: ALL_LANGUAGES,
    difficulty: "HARD",
    timeLimitSeconds: 5,
    testCases: [
      { input: "8\n10 9 2 5 3 7 101 18\n", expectedOutput: "4", hidden: false },
      { input: "5\n5 4 3 2 1\n", expectedOutput: "1", hidden: false },
      { input: "6\n1 1 1 1 1 1\n", expectedOutput: "1", hidden: true },
      { input: "10\n3 10 2 1 20 4 6 7 8 30\n", expectedOutput: "6", hidden: true },
      bigLisCase(),
    ],
  },
  {
    title: "Menor caminho no labirinto",
    statement:
      "Leia `R` e `C` e depois `R` linhas com `C` caracteres: `.` é livre e `#` é parede. Partindo do canto superior esquerdo, andando só para cima, baixo, esquerda ou direita, imprima o menor número de passos até o canto inferior direito, ou `-1` se não houver caminho.\n\nA grade chega a 400 × 400.\n\nEntrada:\n```\n3 4\n..#.\n#...\n.#..\n```\nSaída: `5`.",
    languages: ALL_LANGUAGES,
    difficulty: "HARD",
    timeLimitSeconds: 5,
    testCases: [
      { input: "3 4\n..#.\n#...\n.#..\n", expectedOutput: "5", hidden: false },
      { input: "2 2\n.#\n#.\n", expectedOutput: "-1", hidden: false },
      { input: "1 1\n.\n", expectedOutput: "0", hidden: true },
      { input: "4 4\n....\n###.\n....\n.###\n", expectedOutput: "-1", hidden: true },
      { input: "5 5\n.....\n.###.\n...#.\n##.#.\n.....\n", expectedOutput: "8", hidden: true },
      bigGridCase(),
    ],
  },
  {
    title: "Mochila 0/1",
    statement:
      "Leia `N` (itens) e `W` (capacidade) e depois `N` linhas com o peso e o valor de cada item. Cada item pode ser levado no máximo uma vez. Imprima o maior valor total possível sem passar da capacidade.\n\n`N` chega a 200 e `W` a 10.000: testar todas as combinações não termina a tempo.\n\nEntrada:\n```\n3 50\n10 60\n20 100\n30 120\n```\nSaída: `220`.",
    languages: ALL_LANGUAGES,
    difficulty: "HARD",
    timeLimitSeconds: 5,
    testCases: [
      { input: "3 50\n10 60\n20 100\n30 120\n", expectedOutput: "220", hidden: false },
      { input: "2 5\n6 100\n7 200\n", expectedOutput: "0", hidden: false },
      { input: "4 7\n1 1\n3 4\n4 5\n5 7\n", expectedOutput: "9", hidden: true },
      { input: "1 10\n10 42\n", expectedOutput: "42", hidden: true },
      bigKnapsackCase(),
    ],
  },
  {
    title: "Rota mais barata",
    statement:
      "Leia `N` (cidades, numeradas de 1 a `N`) e `M` (estradas) e depois `M` linhas `u v w`: uma estrada de mão dupla entre `u` e `v` com custo `w` (positivo). Imprima o menor custo para ir da cidade 1 à cidade `N`, ou `-1` se não for possível.\n\n`N` chega a 10.000 e `M` a 30.000.\n\nEntrada:\n```\n4 5\n1 2 4\n1 3 1\n3 2 2\n2 4 1\n3 4 5\n```\nSaída: `4` (1 → 3 → 2 → 4).",
    languages: ALL_LANGUAGES,
    difficulty: "HARD",
    timeLimitSeconds: 5,
    testCases: [
      { input: "4 5\n1 2 4\n1 3 1\n3 2 2\n2 4 1\n3 4 5\n", expectedOutput: "4", hidden: false },
      { input: "3 1\n1 2 7\n", expectedOutput: "-1", hidden: false },
      { input: "2 2\n1 2 10\n1 2 3\n", expectedOutput: "3", hidden: true },
      { input: "5 6\n1 2 2\n2 5 10\n1 3 3\n3 4 1\n4 5 2\n2 3 1\n", expectedOutput: "6", hidden: true },
      bigGraphCase(),
    ],
  },
];
