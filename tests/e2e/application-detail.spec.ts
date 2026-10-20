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

async function signUpCandidate(page: Page, name: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("E-mail").fill(`e2e-detail-${Date.now()}@example.com`);
  await page.getByLabel("Senha").fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/vagas$/);
}

test("recrutador abre relatório do candidato, vê score/currículo e avança a etapa (RF08)", async ({ page, browser }) => {
  // Nome único por teste: as execuções acumulam candidaturas na mesma vaga do seed.
  const CANDIDATE_NAME = `Candidato Fluxo 4 ${Date.now()}`;
  // Candidato se candidata a uma vaga publicada do seed numa sessão separada.
  const candidateContext = await browser.newContext();
  const candidatePage = await candidateContext.newPage();
  await signUpCandidate(candidatePage, CANDIDATE_NAME);

  const validPdf = path.join(__dirname, "fixtures", "cv-valido.pdf");
  await candidatePage.goto("/perfil");
  await candidatePage.setInputFiles('input[type="file"]', validPdf);
  await expect(candidatePage.getByText(/cv-valido\.pdf/)).toBeVisible();

  await candidatePage.goto("/vagas");
  const firstJobLink = candidatePage.locator('a[href^="/vagas/"]').first();
  await firstJobLink.click();
  await expect(candidatePage).toHaveURL(/\/vagas\/.+/);
  // Lido antes de candidatar: depois da candidatura o candidato vai para /candidaturas (spec 004 US2.5).
  const jobUrl = candidatePage.url();
  await candidatePage.getByRole("button", { name: "Candidatar-se" }).click();
  await expect(candidatePage.getByText("Candidatura registrada com sucesso!")).toBeVisible();
  await expect(candidatePage).toHaveURL(/\/candidaturas\?nova=/);
  const jobId = jobUrl.split("/vagas/")[1];
  await candidateContext.close();

  // Recrutador abre o painel de candidatos daquela vaga.
  await loginAsRecruiter(page);
  await page.goto(`/recrutamento/vagas/${jobId}/candidaturas`);
  await page.getByText(CANDIDATE_NAME).click();

  await expect(page.getByRole("heading", { name: CANDIDATE_NAME })).toBeVisible();
  await expect(page.getByText("compatibilidade geral")).toBeVisible();
  await expect(page.getByRole("link", { name: /cv-valido\.pdf/ })).toBeVisible();
  // Spec 005: o cartão do teste de código existe em toda candidatura (com ou sem a etapa).
  await expect(page.getByRole("heading", { name: "Teste de código" })).toBeVisible();

  await page.getByRole("button", { name: "Avançar" }).click();
  // Decisão exige confirmação explícita (spec 004 US5.5). Na última etapa do pipeline,
  // avançar é aprovar — a vaga escolhida depende dos dados do banco.
  await page.getByRole("button", { name: /Confirmar (avanço|aprovação)/ }).click();
  await expect(page.getByText(/Candidato (avançado|aprovado)/)).toBeVisible();
});
