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
