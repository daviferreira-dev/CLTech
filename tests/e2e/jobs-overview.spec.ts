// Visão macro das vagas (RH): todas as vagas de uma vez, com filtros e indicadores do topo.
import { test, expect, type Page } from "@playwright/test";
import { chooseOption } from "./fixtures/select";

// A tela tem DOM duplo (tabela no desktop, cartões no mobile — só um visível por vez via
// CSS). `.and(":visible")` pega a instância que está de fato na tela, qualquer que seja o viewport.
function visibleJobTitle(page: Page, title: string) {
  return page.getByText(title).and(page.locator(":visible"));
}

test("visão geral das vagas mostra indicadores, lista as vagas e filtra por status", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("recrutador@3aq.dev");
  await page.getByLabel("Senha", { exact: true }).fill("Senha123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/recrutamento$/);

  await page.goto("/recrutamento/vagas/visao-geral");
  await expect(page.getByRole("heading", { name: "Visão geral das vagas" })).toBeVisible();

  // Indicadores do topo.
  const indicators = page.getByRole("region", { name: "Indicadores" });
  await expect(indicators.getByText("Vagas abertas")).toBeVisible();
  await expect(indicators.getByText("Candidatos ativos")).toBeVisible();
  await expect(indicators.getByText("Aguardando decisão")).toBeVisible();

  // A vaga encerrada do seed aparece na lista (tabela no desktop, cartão no mobile).
  await expect(visibleJobTitle(page, "Vaga Encerrada — Suporte Técnico")).toBeVisible();

  // Filtra por status "Encerrada": só essa vaga deve sobrar.
  const statusSelect = page.getByLabel("Status", { exact: true });
  await chooseOption(statusSelect, "Encerrada");

  await expect(visibleJobTitle(page, "Vaga Encerrada — Suporte Técnico")).toBeVisible();
  // toHaveCount (não toBeVisible): o DOM tem a versão desktop e a mobile da mesma vaga, então
  // um texto filtrado para fora precisa ir a zero ocorrências nas duas, não só "não visível".
  await expect(page.getByText("Desenvolvedor(a) Frontend React Pleno")).toHaveCount(0);
});

test("alterna entre a lista simples e a visão geral das vagas", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("recrutador@3aq.dev");
  await page.getByLabel("Senha", { exact: true }).fill("Senha123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/recrutamento$/);

  await page.goto("/recrutamento/vagas");
  await expect(page.getByRole("heading", { name: "Minhas vagas" })).toBeVisible();

  await page.getByRole("tab", { name: "Visão geral" }).click();
  await expect(page).toHaveURL(/\/recrutamento\/vagas\/visao-geral$/);
  await expect(page.getByRole("heading", { name: "Visão geral das vagas" })).toBeVisible();

  await page.getByRole("tab", { name: "Lista" }).click();
  await expect(page).toHaveURL(/\/recrutamento\/vagas$/);
});
