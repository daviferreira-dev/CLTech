// Fluxo 4 do quickstart.md — User Story 4 (Sprint 2).
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loginAsRecruiter(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("recrutador@3aq.dev");
  await page.getByLabel("Senha").fill("Senha123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/recrutamento$/);
}

async function signUpCandidate(page: Page) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Candidato Fluxo 4");
  await page.getByLabel("E-mail").fill(`e2e-detail-${Date.now()}@example.com`);
  await page.getByLabel("Senha").fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/vagas$/);
}

test("recrutador abre relatório do candidato, vê score/currículo e avança a etapa (RF08)", async ({ page, browser }) => {
  // Candidato se candidata a uma vaga publicada do seed numa sessão separada.
  const candidateContext = await browser.newContext();
  const candidatePage = await candidateContext.newPage();
  await signUpCandidate(candidatePage);

  const validPdf = path.join(__dirname, "fixtures", "cv-valido.pdf");
  await candidatePage.goto("/perfil");
  await candidatePage.setInputFiles('input[type="file"]', validPdf);
  await expect(candidatePage.getByText(/cv-valido\.pdf/)).toBeVisible();

  await candidatePage.goto("/vagas");
  const firstJobLink = candidatePage.locator('a[href^="/vagas/"]').first();
  await firstJobLink.click();
  await candidatePage.getByRole("button", { name: "Candidatar-se" }).click();
  await expect(candidatePage.getByText("Candidatura registrada com sucesso!")).toBeVisible();
  const jobUrl = candidatePage.url();
  const jobId = jobUrl.split("/vagas/")[1];
  await candidateContext.close();

  // Recrutador abre o painel de candidatos daquela vaga.
  await loginAsRecruiter(page);
  await page.goto(`/recrutamento/vagas/${jobId}/candidaturas`);
  await page.getByText("Candidato Fluxo 4").click();

  await expect(page.getByRole("heading", { name: "Candidato Fluxo 4" })).toBeVisible();
  await expect(page.getByText("compatibilidade geral")).toBeVisible();
  await expect(page.getByRole("link", { name: /cv-valido\.pdf/ })).toBeVisible();
  await expect(page.getByText("Ainda não disponível nesta versão.")).toBeVisible();

  await page.getByRole("button", { name: "Avançar" }).click();
  await expect(page.getByText("Candidato avançado.")).toBeVisible();
});
