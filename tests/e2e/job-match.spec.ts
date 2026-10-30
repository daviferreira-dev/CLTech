// Fluxo 1 do quickstart.md — User Story 1 (Sprint 2).
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REACT_JOB_TITLE = "Desenvolvedor(a) Frontend React Pleno";

function uniqueEmail() {
  return `e2e-match-${Date.now()}@example.com`;
}

async function signUp(page: Page, email: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Pessoa Match");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/vagas$/);
}

async function uploadResume(page: Page, fixtureName: string, { replacing = false } = {}) {
  await page.goto("/perfil");
  await page.setInputFiles('input[type="file"]', path.join(__dirname, "fixtures", fixtureName));
  // Substituir o currículo vigente exige confirmação (spec 004 FR-105).
  if (replacing) await page.getByRole("button", { name: "Substituir currículo" }).click();
  await expect(page.getByText(new RegExp(fixtureName.replace(".", "\\.")))).toBeVisible();
}

/**
 * O recálculo de JobMatch é fire-and-forget (contracts/api.md) — recarrega até aparecer.
 * Escopa no card da vaga: um mesmo percentual (ex. 0%) aparece em várias vagas da listagem,
 * e um `getByText` solto violaria o strict mode do Playwright.
 */
async function waitForJobMatch(page: Page, jobTitle: string, pattern: RegExp) {
  await expect(async () => {
    await page.goto("/vagas");
    await expect(page.getByRole("listitem").filter({ hasText: jobTitle }).getByText(pattern)).toBeVisible();
  }).toPass({ timeout: 15000, intervals: [500, 1000, 2000] });
}

test("deslogado nunca vê percentual de compatibilidade (FR-035)", async ({ page }) => {
  await page.goto("/vagas");
  await expect(page.getByText(/% match/)).toHaveCount(0);
});

test("candidato sem currículo vê orientação em vez de um número (FR-036)", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await page.goto("/vagas");
  await expect(page.getByText("Complete seu perfil para ver seu match.").first()).toBeVisible();
  await expect(page.getByText(/% match/)).toHaveCount(0);
});

test("compatibilidade aparece, muda com o currículo, e some ao deslogar (FR-033, FR-034)", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await uploadResume(page, "cv-react-node.docx");

  await waitForJobMatch(page, REACT_JOB_TITLE, /67% match/);

  await page.getByRole("link", { name: REACT_JOB_TITLE }).click();
  await expect(page).toHaveURL(/\/vagas\/.+/);
  await expect(page.getByText("Sua compatibilidade: 67%")).toBeVisible();
  await expect(page.getByText(/Encontradas no seu perfil/)).toBeVisible();
  await expect(page.getByText(/Ainda faltando/)).toBeVisible();

  await uploadResume(page, "cv-python-django.docx", { replacing: true });
  await waitForJobMatch(page, REACT_JOB_TITLE, /0% match/);
});
