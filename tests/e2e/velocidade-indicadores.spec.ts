// Spec 010: o painel do recrutador mostra a meta (anúncio → proposta) e os candidatos parados,
// e os dois seguem o recorte por vaga.
import { test, expect, type Page } from "@playwright/test";

async function loginAsRecruiter(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("recrutador@3aq.dev");
  await page.getByLabel("Senha", { exact: true }).fill("Senha123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/recrutamento$/);
}

test("painel mostra o tempo do anúncio à proposta e os candidatos parados (spec 010)", async ({ page }) => {
  await loginAsRecruiter(page);

  const indicators = page.getByRole("region", { name: "Indicadores" });
  await expect(indicators.getByText("Do anúncio à proposta")).toBeVisible();
  // Nunca "0 dias" nem NaN: ou a média em dias, ou "Sem dados" com a explicação.
  await expect(indicators.getByText(/^(\d+(,\d)? dias|Sem dados)$/)).toBeVisible();
  await expect(indicators.getByText(/NaN/)).toHaveCount(0);

  const stalled = page.getByRole("region", { name: "Candidatos parados" });
  await expect(stalled).toBeVisible();
  await expect(stalled.getByText(/há mais de \d+ dias? na mesma etapa/i)).toBeVisible();

  // Recorte por vaga: o card e a lista continuam lá.
  const jobSelect = page.getByRole("combobox");
  await jobSelect.click();
  const options = await page.getByRole("option").allTextContents();
  await page.getByRole("option", { name: options[1] as string, exact: true }).click();
  await expect(page).toHaveURL(/\?vaga=/);
  await expect(indicators.getByText("Do anúncio à proposta")).toBeVisible();
  await expect(stalled).toBeVisible();
});

test("o card da meta segue o período de publicação, como a visão geral (spec 010 US1.5)", async ({ page }) => {
  await loginAsRecruiter(page);
  const indicators = page.getByRole("region", { name: "Indicadores" });
  const card = indicators.getByText("Do anúncio à proposta").locator("..");

  // Período no futuro: nenhuma vaga publicada nele, então o card diz isso (nunca 0 dias).
  await page.getByLabel("Publicada de").fill("2999-01-01");
  await expect(page).toHaveURL(/[?&]de=2999-01-01/);
  await expect(card.getByText("Sem dados", { exact: true })).toBeVisible();
  await expect(card.getByText(/Ainda sem vaga que chegou à proposta\. Só vagas publicadas no período escolhido\./)).toBeVisible();
  // O resto do painel não é recortado pelo período.
  await expect(page.getByRole("region", { name: "Candidatos parados" })).toBeVisible();

  // Mudar dois campos seguidos não perde o primeiro (a URL é a fonte da verdade).
  await page.getByLabel("Publicada de").fill("2998-01-01");
  await page.getByLabel("até", { exact: true }).fill("2999-12-31");
  await expect(page).toHaveURL(/[?&]de=2998-01-01/);
  await expect(page).toHaveURL(/[?&]ate=2999-12-31/);
  await page.getByLabel("até", { exact: true }).fill("");
  await page.getByLabel("Publicada de").fill("2999-01-01");
  await expect(page).not.toHaveURL(/[?&]ate=/);

  // O período sobrevive a recarregar; limpar volta ao card sem recorte.
  await page.reload();
  await expect(page.getByLabel("Publicada de")).toHaveValue("2999-01-01");
  await page.getByLabel("Publicada de").fill("");
  await expect(page).not.toHaveURL(/[?&]de=/);
  await expect(card.getByText("Só vagas publicadas no período escolhido.", { exact: false })).toHaveCount(0);
});

test("visão geral abre o tempo por etapa de uma vaga (spec 010 US4)", async ({ page }) => {
  await loginAsRecruiter(page);
  await page.goto("/recrutamento/vagas/visao-geral");

  // Tabela no desktop, cartões no mobile: vale o botão que estiver visível.
  const toggle = page.getByRole("button", { name: "Tempo por etapa" }).locator("visible=true").first();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  const panel = page.locator(`#${await toggle.getAttribute("aria-controls")}`);
  // Lista das etapas ou o aviso de pouca movimentação — nunca erro.
  await expect(panel.getByText(/Tempo médio|Ninguém saiu desta etapa|Ainda sem movimentação/).first()).toBeVisible();
  await expect(panel.getByText("Não conseguimos carregar")).toHaveCount(0);

  // Abrir não navega: o botão fica acima do link que cobre a linha.
  await expect(page).toHaveURL(/\/recrutamento\/vagas\/visao-geral/);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toHaveCount(0);
});
