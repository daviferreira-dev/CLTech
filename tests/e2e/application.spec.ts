// Fluxo 3 do quickstart.md — User Story 3.
import { test, expect } from "@playwright/test";
import { chooseOption } from "./fixtures/select";

function uniqueEmail() {
  return `e2e-apply-${Date.now()}@example.com`;
}

test("listagem de vagas é visível sem login", async ({ page }) => {
  await page.goto("/vagas");
  await expect(page.getByRole("heading", { name: "Vagas abertas", level: 1 })).toBeVisible();
});

test("filtrar por modalidade reduz a lista", async ({ page }) => {
  await page.goto("/vagas");
  const response = page.waitForResponse((res) => res.url().includes("/api/jobs"));
  await chooseOption(page.getByRole("combobox").first(), "Remoto");
  await response;
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
  // O href só ganha o callbackUrl depois da hidratação (useSearchParams): clicar antes perde o retorno.
  const register = page.getByRole("link", { name: "Cadastre-se" });
  await expect(register).toHaveAttribute("href", /callbackUrl=/);
  await register.click();
  await expect(page).toHaveURL(/\/cadastro\?callbackUrl=/);
  // Antes da hidratação o "Criar conta" faria um submit nativo (GET /cadastro?) e perderia o retorno.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome").fill("Pessoa Candidatura");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();

  // Spec 004 US2.1: o cadastro preserva o callbackUrl e devolve o candidato à mesma vaga.
  await expect(page).toHaveURL(jobUrl);
});

test("candidato sem currículo é orientado a completar o perfil ao tentar se candidatar", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Pessoa Sem CV");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/vagas$/);

  // O AppHeader também tem links (pular conteúdo, logo, navegação): mira o cartão de vaga.
  await page.locator('a[href^="/vagas/"]').first().click();
  await page.getByRole("button", { name: "Candidatar-se" }).click();

  await expect(page.getByText(/Complete seu perfil com um currículo/)).toBeVisible();
});
