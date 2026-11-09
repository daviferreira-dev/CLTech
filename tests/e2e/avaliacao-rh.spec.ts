// Spec 009: reprovar com motivo e retorno (que chega no e-mail) e reprovar vários de uma vez.
import { test, expect, type Browser, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chooseOption } from "./fixtures/select";
import { waitForMailContaining } from "./fixtures/mailpit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loginAsRecruiter(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("recrutador@3aq.dev");
  await page.getByLabel("Senha", { exact: true }).fill("Senha123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/recrutamento$/);
}

/** Candidato novo, com currículo, candidatado à primeira vaga publicada. */
async function applyAsNewCandidate(browser: Browser, name: string) {
  const email = `e2e-rh-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/vagas$/);

  await page.goto("/perfil");
  await page.setInputFiles('input[type="file"]', path.join(__dirname, "fixtures", "cv-valido.pdf"));
  await expect(page.getByText(/cv-valido\.pdf/)).toBeVisible();

  await page.goto("/vagas");
  await page.locator('a[href^="/vagas/"]').first().click();
  await expect(page).toHaveURL(/\/vagas\/.+/);
  const jobId = page.url().split("/vagas/")[1]!;
  await page.getByRole("button", { name: "Candidatar-se" }).click();
  await expect(page).toHaveURL(/\/candidaturas\?nova=/);
  await context.close();
  return { email, jobId };
}

test("reprovar exige motivo e o retorno chega no e-mail do candidato", async ({ page, browser }) => {
  const name = `Reprovado E2E ${Date.now()}`;
  const { email, jobId } = await applyAsNewCandidate(browser, name);

  await loginAsRecruiter(page);
  await page.goto(`/recrutamento/vagas/${jobId}/candidaturas`);
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.getByRole("button", { name: "Reprovar" }).click();
  const dialog = page.getByRole("dialog");
  // Sem motivo não confirma.
  await dialog.getByRole("button", { name: "Confirmar reprovação" }).click();
  await expect(dialog.getByText("Escolha o motivo da reprovação.")).toBeVisible();

  await chooseOption(dialog.getByRole("combobox", { name: "Motivo" }), "Requisitos mínimos da vaga não atendidos");
  await dialog.getByLabel("Retorno ao candidato (opcional)").fill("Vale aprofundar testes automatizados.");
  await dialog.getByRole("button", { name: "Confirmar reprovação" }).click();

  await expect(page.getByText("Motivo: Requisitos mínimos da vaga não atendidos")).toBeVisible();
  // O assunto depende do modelo de reprovação da vaga; o retorno tem de estar no texto.
  const text = await waitForMailContaining(email, "Vale aprofundar testes automatizados.");
  expect(text).toContain(name.split(" ")[0]!);
});

test("reprovar dois candidatos de uma vez na lista da vaga", async ({ page, browser }) => {
  const stamp = Date.now();
  const first = await applyAsNewCandidate(browser, `Lote A ${stamp}`);
  const second = await applyAsNewCandidate(browser, `Lote B ${stamp}`);
  expect(second.jobId).toBe(first.jobId);

  await loginAsRecruiter(page);
  await page.goto(`/recrutamento/vagas/${first.jobId}/candidaturas`);
  await page.getByRole("checkbox", { name: `Selecionar Lote A ${stamp}` }).check();
  await page.getByRole("checkbox", { name: `Selecionar Lote B ${stamp}` }).check();
  await page.getByRole("button", { name: "Reprovar selecionados" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Reprovar 2 candidatos?" })).toBeVisible();
  await chooseOption(dialog.getByRole("combobox", { name: "Motivo" }), "Outros motivos");
  await dialog.getByRole("button", { name: "Confirmar reprovação" }).click();

  await expect(page.getByText("2 reprovados.")).toBeVisible();
  // Reprovados saem da seleção: não há mais caixa para eles.
  await expect(page.getByRole("checkbox", { name: `Selecionar Lote A ${stamp}` })).toHaveCount(0);
});
