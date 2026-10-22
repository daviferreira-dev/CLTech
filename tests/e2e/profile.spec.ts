// Fluxo 2 do quickstart.md — User Story 2.
import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function uniqueEmail() {
  return `e2e-profile-${Date.now()}@example.com`;
}

async function signUp(page: import("@playwright/test").Page, email: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Pessoa Perfil");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/vagas$/);
}

test("preencher telefone e cidade persiste após recarregar (FR-009)", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await page.goto("/perfil");

  await page.getByLabel("Telefone").fill("85999999999");
  await page.getByLabel("Cidade", { exact: true }).fill("Fortaleza");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Telefone")).toHaveValue("85999999999");
  await expect(page.getByLabel("Cidade", { exact: true })).toHaveValue("Fortaleza");
});

test("upload de PDF válido é aceito; .txt é recusado sem apagar o anterior (FR-014)", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await page.goto("/perfil");

  const validPdf = path.join(__dirname, "fixtures", "cv-valido.pdf");
  await page.setInputFiles('input[type="file"]', validPdf);
  await expect(page.getByText(/cv-valido\.pdf/)).toBeVisible();

  const invalidTxt = path.join(__dirname, "fixtures", "cv-invalido.txt");
  await page.setInputFiles('input[type="file"]', invalidTxt);
  // Substituir o currículo vigente exige confirmação (spec 004 FR-105).
  await page.getByRole("button", { name: "Substituir currículo" }).click();
  await expect(page.getByText(/Envie um arquivo PDF ou DOCX/)).toBeVisible();
  // currículo anterior continua vigente
  await expect(page.getByText(/cv-valido\.pdf/)).toBeVisible();
});
