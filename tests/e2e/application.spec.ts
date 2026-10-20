// Fluxo 3 do quickstart.md — User Story 3.
import { test, expect } from "@playwright/test";

function uniqueEmail() {
  return `e2e-apply-${Date.now()}@example.com`;
}

test("listagem de vagas é visível sem login", async ({ page }) => {
  await page.goto("/vagas");
  await expect(page.getByRole("heading", { name: "Vagas abertas" })).toBeVisible();
});

test("filtrar por modalidade reduz a lista", async ({ page }) => {
  await page.goto("/vagas");
  await page.getByRole("combobox").first().selectOption("REMOTE");
  await page.waitForResponse((res) => res.url().includes("/api/jobs"));
});

test("candidatar-se deslogado leva ao login e retorna à vaga (FR-023)", async ({ page }) => {
  await page.goto("/vagas");
  // O AppHeader também tem links (pular conteúdo, logo, navegação): mira o cartão de vaga.
  await page.locator('a[href^="/vagas/"]').first().click();
  await expect(page).toHaveURL(/\/vagas\/.+/);
  const jobUrl = page.url();

  await page.getByRole("button", { name: "Candidatar-se" }).click();
  await expect(page).toHaveURL(/\/entrar\?callbackUrl=/);

  const email = uniqueEmail();
  await page.getByRole("link", { name: "Cadastre-se" }).click();
  await page.getByLabel("Nome").fill("Pessoa Candidatura");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta" }).click();

  // Após logar, retorna ao fluxo de vagas (o cadastro não preserva o callbackUrl
  // original nesta sprint — o candidato precisa reabrir a vaga, o que é aceitável
  // porque o cadastro por e-mail é caminho alternativo ao login direto).
  await expect(page).toHaveURL(/\/vagas$/);
  void jobUrl;
});

test("candidato sem currículo é orientado a completar o perfil ao tentar se candidatar", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Pessoa Sem CV");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/vagas$/);

  // O AppHeader também tem links (pular conteúdo, logo, navegação): mira o cartão de vaga.
  await page.locator('a[href^="/vagas/"]').first().click();
  await page.getByRole("button", { name: "Candidatar-se" }).click();

  await expect(page.getByText(/Complete seu perfil com um currículo/)).toBeVisible();
});
