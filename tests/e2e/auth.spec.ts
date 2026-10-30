// Fluxo 1 do quickstart.md — User Story 1.
import { test, expect } from "@playwright/test";

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
}

test("cadastro leva à listagem de vagas (FR-001, FR-006)", async ({ page }) => {
  const email = uniqueEmail();

  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Pessoa E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();

  await expect(page).toHaveURL(/\/vagas$/);
});

test("login com senha errada não cria sessão (FR-004)", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("inexistente@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("senhaErrada");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);
});

test("recrutador do seed cai em /recrutamento, não em /vagas (FR-006)", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("recrutador@3aq.dev");
  await page.getByLabel("Senha", { exact: true }).fill("Senha123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page).toHaveURL(/\/recrutamento$/);
});

test("sessão persiste após fechar e reabrir o navegador", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = uniqueEmail();

  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Pessoa Persistente");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/vagas$/);

  const storageState = await context.storageState();
  await context.close();

  const newContext = await browser.newContext({ storageState });
  const newPage = await newContext.newPage();
  await newPage.goto("/vagas");
  await expect(newPage).toHaveURL(/\/vagas$/);
  await newContext.close();
});
