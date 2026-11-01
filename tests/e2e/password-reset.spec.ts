// Esqueci minha senha (e-mail real no Mailpit) e troca de senha logado.
import { test, expect, type Page } from "@playwright/test";
import { waitForMail, linkFrom } from "./fixtures/mailpit";

function uniqueEmail() {
  return `reset-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.test`;
}

async function register(page: Page, email: string, password: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Pessoa Senha");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/vagas$/);
}

test.describe("esqueci minha senha", () => {
  test("fluxo completo: pedir, receber e-mail, redefinir e entrar com a senha nova", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email, "senhaAntiga123");
    await page.context().clearCookies();

    await page.goto("/entrar");
    await page.getByRole("link", { name: "Esqueci minha senha" }).click();
    await expect(page).toHaveURL(/\/esqueci-senha/);
    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByText("Confira seu e-mail")).toBeVisible();

    const text = await waitForMail(email, "Redefina sua senha da CLTech");
    const link = linkFrom(text, "/redefinir-senha");

    await page.goto(link);
    // O token sai da URL visível assim que a página carrega.
    await expect(page).toHaveURL(/\/redefinir-senha$/);
    await page.getByLabel("Senha nova", { exact: true }).fill("senhaNova456");
    await page.getByLabel("Repita a senha nova").fill("senhaNova456");
    await page.getByRole("button", { name: "Salvar senha nova" }).click();
    await expect(page.getByText("Senha alterada")).toBeVisible();

    await page.getByRole("link", { name: "Entrar" }).click();
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill("senhaNova456");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/vagas$/);

    await waitForMail(email, "Sua senha da CLTech foi alterada");
  });

  test("e-mail inexistente dá a mesma resposta, sem mandar nada", async ({ page }) => {
    await page.goto("/esqueci-senha");
    await page.getByLabel("E-mail").fill("ninguem-" + Date.now() + "@example.test");
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByText("Confira seu e-mail")).toBeVisible();
  });

  test("link usado não funciona de novo", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email, "senhaAntiga123");
    await page.context().clearCookies();

    await page.goto("/esqueci-senha");
    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("button", { name: "Enviar link" }).click();
    const link = linkFrom(await waitForMail(email, "Redefina sua senha da CLTech"), "/redefinir-senha");

    await page.goto(link);
    await page.getByLabel("Senha nova", { exact: true }).fill("senhaNova456");
    await page.getByLabel("Repita a senha nova").fill("senhaNova456");
    await page.getByRole("button", { name: "Salvar senha nova" }).click();
    await expect(page.getByText("Senha alterada")).toBeVisible();

    await page.goto(link);
    await page.getByLabel("Senha nova", { exact: true }).fill("outraSenha789");
    await page.getByLabel("Repita a senha nova").fill("outraSenha789");
    await page.getByRole("button", { name: "Salvar senha nova" }).click();
    await expect(page.getByText(/expirou ou já foi usado/)).toBeVisible();
  });
});

test.describe("trocar senha logado", () => {
  test("troca a senha, derruba a sessão e exige login de novo", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email, "senhaAntiga123");

    await page.goto("/perfil");
    await page.getByRole("link", { name: "Trocar senha" }).click();
    await expect(page).toHaveURL(/\/perfil\/senha/);

    await page.getByLabel("Senha atual").fill("senhaErrada");
    await page.getByLabel("Senha nova", { exact: true }).fill("senhaNova456");
    await page.getByLabel("Repita a senha nova").fill("senhaNova456");
    await page.getByRole("button", { name: "Salvar senha nova" }).click();
    await expect(page.getByText("A senha atual está incorreta.")).toBeVisible();

    await page.getByLabel("Senha atual").fill("senhaAntiga123");
    await page.getByRole("button", { name: "Salvar senha nova" }).click();
    await expect(page.getByText("Senha alterada")).toBeVisible();

    await waitForMail(email, "Sua senha da CLTech foi alterada");

    await page.context().clearCookies();
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill("senhaAntiga123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.locator("p[role=alert]")).toHaveText("E-mail ou senha incorretos.");

    await page.getByLabel("Senha", { exact: true }).fill("senhaNova456");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/vagas$/);
  });
});
