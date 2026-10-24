// Tarefas disparadas sem await (recálculo de match, coleta do GitHub, correção de código).
// Em serverless (Vercel) a função congela assim que a resposta sai e a tarefa morreria no meio;
// `after` segura a execução até ela terminar. Fora de uma requisição (testes, seed) `after`
// lança, e aí basta deixar a promise correr — ela já foi iniciada por quem chamou.
import { after } from "next/server";

export function keepAlive(task: Promise<unknown>): void {
  try {
    after(task);
  } catch {
    // fora do escopo de requisição: nada a segurar
  }
}
