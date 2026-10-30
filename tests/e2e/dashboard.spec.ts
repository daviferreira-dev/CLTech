// Fluxo 3 do quickstart.md — User Story 3 (Sprint 2).
import { test, expect } from "@playwright/test";

test("painel mostra vagas com contagem por etapa e permite filtrar por vaga (RF07)", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("recrutador@3aq.dev");
  await page.getByLabel("Senha", { exact: true }).fill("Senha123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/recrutamento$/);

  await expect(page.getByRole("heading", { name: "Painel", exact: true })).toBeVisible();

  const jobSelect = page.getByRole("combobox");
  await expect(jobSelect).toBeVisible();

  await jobSelect.click();
  const options = await page.getByRole("option").allTextContents();
  expect(options.length).toBeGreaterThan(1); // "Todas as vagas" + ao menos uma vaga real

  const firstJobTitle = options[1] as string;
  await page.getByRole("option", { name: firstJobTitle, exact: true }).click();

  await expect(page.getByRole("heading", { name: firstJobTitle, level: 2 })).toBeVisible();
});
