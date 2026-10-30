// User Story 4 — "Minhas candidaturas".
import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function uniqueEmail() {
  return `e2e-myapps-${Date.now()}@example.com`;
}

test("candidato sem candidaturas vê estado vazio orientando a explorar vagas", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Pessoa Sem Candidatura");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/vagas$/);

  await page.goto("/candidaturas");
  await expect(page.getByText("Você ainda não se candidatou a nenhuma vaga.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Explorar vagas abertas" })).toBeVisible();
});

test("duas candidaturas aparecem com status correto (FR-025)", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Pessoa Duas Candidaturas");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/vagas$/);

  await page.goto("/perfil");
  const validPdf = path.join(__dirname, "fixtures", "cv-valido.pdf");
  await page.setInputFiles('input[type="file"]', validPdf);
  await expect(page.getByText(/cv-valido\.pdf/)).toBeVisible();

  await page.goto("/vagas");
  const jobLinks = page.locator('a[href^="/vagas/"]');
  const firstTitle = await jobLinks.nth(0).innerText();
  const secondTitle = await jobLinks.nth(1).innerText();

  await jobLinks.nth(0).click();
  await page.getByRole("button", { name: "Candidatar-se" }).click();
  await expect(page.getByText("Candidatura enviada.")).toBeVisible();

  await page.goto("/vagas");
  await page.getByRole("link", { name: secondTitle }).click();
  await page.getByRole("button", { name: "Candidatar-se" }).click();
  await expect(page.getByText("Candidatura enviada.")).toBeVisible();

  await page.goto("/candidaturas");
  await expect(page.getByText(firstTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(secondTitle, { exact: true })).toBeVisible();
  await expect(page.getByText("Em andamento")).toHaveCount(2);
});
