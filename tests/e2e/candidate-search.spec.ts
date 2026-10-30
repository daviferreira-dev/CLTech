// Fluxo 5 do quickstart.md — User Story 5 (Sprint 2, P2).
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

test("recrutador busca candidato por e-mail e vê as duas candidaturas agrupadas (RF09)", async ({ page, browser }) => {
  const email = `e2e-search-${Date.now()}@example.com`;

  const candidateContext = await browser.newContext();
  const candidatePage = await candidateContext.newPage();
  await candidatePage.goto("/cadastro");
  await candidatePage.getByLabel("Nome").fill("Candidato Busca");
  await candidatePage.getByLabel("E-mail").fill(email);
  await candidatePage.getByLabel("Senha").fill("senhaSegura123");
  await candidatePage.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(candidatePage).toHaveURL(/\/vagas$/);

  await candidatePage.goto("/perfil");
  await candidatePage.setInputFiles('input[type="file"]', path.join(__dirname, "fixtures", "cv-valido.pdf"));
  await expect(candidatePage.getByText(/cv-valido\.pdf/)).toBeVisible();

  await candidatePage.goto("/vagas");
  const jobLinks = candidatePage.locator('a[href^="/vagas/"]');
  const firstJobHref = await jobLinks.nth(0).getAttribute("href");
  const secondJobHref = await jobLinks.nth(1).getAttribute("href");

  await candidatePage.goto(firstJobHref as string);
  await candidatePage.getByRole("button", { name: "Candidatar-se" }).click();
  await expect(candidatePage.getByText("Candidatura registrada com sucesso!")).toBeVisible();

  await candidatePage.goto(secondJobHref as string);
  await candidatePage.getByRole("button", { name: "Candidatar-se" }).click();
  await expect(candidatePage.getByText("Candidatura registrada com sucesso!")).toBeVisible();

  await candidateContext.close();

  await loginAsRecruiter(page);
  await page.goto("/recrutamento/candidatos");
  // Buscar antes da hidratação vira submit nativo e a lista não carrega.
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("Nome, e-mail ou tecnologia").fill(email);
  await page.getByRole("button", { name: "Buscar" }).click();

  const card = page.locator("li", { hasText: "Candidato Busca" });
  await expect(card).toBeVisible();
  await expect(card.locator("ul > li")).toHaveCount(2);
});

test("busca sem correspondência mostra mensagem (FR-053)", async ({ page }) => {
  await loginAsRecruiter(page);
  await page.goto("/recrutamento/candidatos");
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("Nome, e-mail ou tecnologia").fill(`inexistente-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("Nenhum candidato encontrado para essa busca.")).toBeVisible();
});
