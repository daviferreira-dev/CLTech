// Fluxo 2 do quickstart.md — User Story 2 (Sprint 2).
import { test, expect, type Page } from "@playwright/test";

async function loginAsRecruiter(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("recrutador@3aq.dev");
  await page.getByLabel("Senha").fill("Senha123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/recrutamento$/);
}

test("recrutador cria vaga, monta pipeline, publica, e vaga publicada trava edição (RF04)", async ({ page }) => {
  await loginAsRecruiter(page);

  await page.goto("/recrutamento/vagas");
  await page.getByRole("link", { name: "Criar Vaga" }).click();
  await expect(page).toHaveURL(/\/recrutamento\/vagas\/nova$/);

  const title = `Vaga E2E ${Date.now()}`;
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Descrição").fill("Descrição de teste E2E.");
  await page.getByLabel("Empresa").fill("3aq");
  await page.getByLabel("Localização").fill("Remoto");
  await page.getByLabel("Tecnologias exigidas (separadas por vírgula)").fill("Go, Kubernetes");
  await page.getByLabel("Requisitos mínimos").fill("Experiência com Go.");

  // Tentar publicar sem etapa nenhuma deve bloquear (RN002) — mas o builder só mostra o
  // botão de publicar após salvar o rascunho, então salva primeiro.
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page).toHaveURL(/\/recrutamento\/vagas\/[^/]+$/);

  await page.getByRole("button", { name: "Publicar Vaga" }).click();
  // Publicar é irreversível: exige confirmação (spec 004 FR-105).
  await page.getByRole("button", { name: "Confirmar publicação" }).click();
  await expect(page.getByText(/Adicione ao menos uma etapa/)).toBeVisible();

  // Monta o pipeline: Análise de Currículo, Análise de GitHub, Entrevista Técnica.
  // O rótulo da etapa também existe como <option> do select — escopar na lista (<li>)
  // evita violação de strict mode do Playwright.
  const stageItem = (label: string) => page.getByRole("listitem").filter({ hasText: label });

  await page.getByLabel("Tipo de etapa").selectOption("RESUME_ANALYSIS");
  await page.getByRole("button", { name: "Adicionar etapa" }).click();
  await expect(stageItem("Análise de Currículo")).toBeVisible();

  await page.getByLabel("Tipo de etapa").selectOption("GITHUB_ANALYSIS");
  await page.getByRole("button", { name: "Adicionar etapa" }).click();
  await expect(stageItem("Análise de GitHub")).toBeVisible();

  await page.getByLabel("Tipo de etapa").selectOption("TECH_INTERVIEW");
  await page.getByRole("button", { name: "Adicionar etapa" }).click();
  await expect(stageItem("Entrevista Técnica")).toBeVisible();

  await page.getByRole("button", { name: "Publicar Vaga" }).click();
  // Publicar é irreversível: exige confirmação (spec 004 FR-105).
  await page.getByRole("button", { name: "Confirmar publicação" }).click();
  await expect(page.getByText("Vaga publicada.")).toBeVisible();
  await expect(page.getByText("Vaga publicada: tecnologias, requisitos mínimos e etapas")).toBeVisible();

  // Aparece na listagem pública.
  await page.goto("/vagas");
  await expect(page.getByText(title)).toBeVisible();

  // Edição de tecnologias fica travada.
  await page.goBack();
  await expect(page.getByLabel("Tecnologias exigidas (separadas por vírgula)")).toBeDisabled();
});
