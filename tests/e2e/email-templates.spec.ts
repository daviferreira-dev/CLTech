// Spec 008 — biblioteca de modelos de e-mail do RH (/recrutamento/modelos-de-email).
import { test, expect, type Page } from "@playwright/test";

async function loginAsRecruiter(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("recrutador@3aq.dev");
  await page.getByLabel("Senha", { exact: true }).fill("Senha123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/recrutamento$/);
}

test("RH edita o modelo padrão, cria um modelo próprio, duplica e exclui", async ({ page }) => {
  await loginAsRecruiter(page);

  await page.goto("/recrutamento/modelos-de-email");
  await expect(page.getByRole("heading", { name: "Modelos de e-mail" })).toBeVisible();

  // Nome exato no título do card: "(cópia)" não pode casar com o card original por engano.
  const cardNamed = (title: string) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

  // Edita o texto do modelo padrão de "Reprovado" — assunto/corpo, com pré-visualização.
  await cardNamed("Reprovado").getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Assunto").fill("Atualização sobre a vaga {{vaga}} (E2E)");
  await expect(page.getByText("Atualização sobre a vaga Desenvolvedor(a) Backend (E2E)")).toBeVisible();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Atualização sobre a vaga {{vaga}} (E2E)")).toBeVisible();

  // Cria um modelo próprio.
  const name = `Modelo E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Novo modelo" }).click();
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("Assunto").fill("Assunto do modelo E2E — {{vaga}}");
  await page.getByLabel("Mensagem").fill("Olá, {{candidato}}! Mensagem de teste.");
  await page.getByRole("button", { name: "Criar modelo" }).click();

  const customCard = cardNamed(name);
  await expect(customCard).toBeVisible();

  // Duplica — a cópia aparece como outro modelo próprio.
  await customCard.getByRole("button", { name: "Duplicar" }).click();
  const copyCard = cardNamed(`${name} (cópia)`);
  await expect(copyCard).toBeVisible();

  // Exclui os dois modelos criados neste teste.
  for (const card of [customCard, copyCard]) {
    await card.getByRole("button", { name: "Excluir" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();
  }
  await expect(cardNamed(name)).toHaveCount(0);
  await expect(cardNamed(`${name} (cópia)`)).toHaveCount(0);
});
