// Login completo: e-mail/senha, cadastro, botões OAuth (sem sair para o provedor real),
// erros de OAuth e permissões por papel. O primeiro login social em si fica no teste de
// integração (tests/integration/oauth-login.test.ts): não dá para logar no GitHub real aqui.
import { test, expect, type Page } from "@playwright/test";

const RECRUITER = { email: "recrutador@3aq.dev", password: "Senha123!" };

function uniqueEmail() {
  return `login-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.test`;
}

async function login(page: Page, email: string, password: string) {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

async function register(page: Page, email: string, password = "senhaSegura123") {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Pessoa Login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
}

test.describe("e-mail e senha", () => {
  test("recrutador entra e cai em /recrutamento", async ({ page }) => {
    await page.goto("/entrar");
    await login(page, RECRUITER.email, RECRUITER.password);
    await expect(page).toHaveURL(/\/recrutamento$/);
  });

  test("candidato entra e cai em /vagas; Sair encerra a sessão", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);
    await expect(page).toHaveURL(/\/vagas$/);
    await page.context().clearCookies();

    await page.goto("/entrar");
    await login(page, email, "senhaSegura123");
    await expect(page).toHaveURL(/\/vagas$/);

    // `next dev` hidrata depois do primeiro clique às vezes: repete até o menu abrir.
    const menu = page.getByRole("button", { name: /Candidato/ });
    await expect(async () => {
      await menu.click();
      await expect(menu).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
    }).toPass();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/perfil");
    await expect(page).toHaveURL(/\/entrar\?callbackUrl=%2Fperfil/);
  });

  test("senha errada e e-mail inexistente dão a mesma mensagem", async ({ page }) => {
    await page.goto("/entrar");
    await login(page, RECRUITER.email, "senhaErrada1");
    await expect(page.locator("p[role=alert]")).toHaveText("E-mail ou senha incorretos.");
    await expect(page.getByLabel("E-mail")).toHaveValue(RECRUITER.email);

    await login(page, uniqueEmail(), "senhaErrada1");
    await expect(page.locator("p[role=alert]")).toHaveText("E-mail ou senha incorretos.");
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("campos vazios ficam aria-invalid com erro em linha", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByLabel("E-mail")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Informe seu e-mail.")).toBeVisible();
    await expect(page.getByText("Informe sua senha.")).toBeVisible();
  });

  test("mostrar/ocultar senha", async ({ page }) => {
    await page.goto("/entrar");
    const senha = page.getByLabel("Senha", { exact: true });
    await senha.fill("segredo");
    await expect(senha).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Mostrar senha" }).click();
    await expect(senha).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Ocultar senha" }).click();
    await expect(senha).toHaveAttribute("type", "password");
  });

  test("callbackUrl volta para a página protegida pedida", async ({ page }) => {
    await page.goto("/recrutamento/vagas");
    await expect(page).toHaveURL(/\/entrar\?callbackUrl=%2Frecrutamento%2Fvagas/);
    await login(page, RECRUITER.email, RECRUITER.password);
    await expect(page).toHaveURL(/\/recrutamento\/vagas$/);
  });
});

test.describe("cadastro", () => {
  test("e-mail duplicado e senha curta mostram erro", async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email);
    await expect(page).toHaveURL(/\/vagas$/);
    await page.context().clearCookies();

    await register(page, email);
    await expect(page).toHaveURL(/\/cadastro/);
    await expect(page.locator("[aria-invalid=true], [role=alert]").first()).toBeVisible();

    await register(page, uniqueEmail(), "curta");
    await expect(page).toHaveURL(/\/cadastro/);
    await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("botões OAuth", () => {
  const providers = [
    {
      id: "github",
      button: /Entrar com GitHub|Criar conta com GitHub/,
      authorize: "https://github.com/login/oauth/authorize",
      scopes: ["read:user", "user:email"],
    },
    {
      id: "linkedin",
      button: /Entrar com LinkedIn/,
      authorize: "https://www.linkedin.com/oauth/v2/authorization",
      scopes: ["openid", "profile", "email"],
    },
  ];

  test("/api/auth/providers lista GitHub e LinkedIn", async ({ request }) => {
    const body = await (await request.get("/api/auth/providers")).json();
    expect(Object.keys(body)).toEqual(expect.arrayContaining(["credentials", "github", "linkedin"]));
  });

  for (const path of ["/entrar", "/cadastro"]) {
    for (const p of providers) {
      // ponytail: /cadastro só tem o botão do GitHub; o LinkedIn cria conta pelo /entrar.
      if (path === "/cadastro" && p.id === "linkedin") continue;

      test(`${path}: ${p.id} redireciona com client_id, redirect_uri, scope e state/PKCE`, async ({ page }) => {
        // Nunca sai para o provedor real: a navegação é capturada e respondida aqui.
        await page.route(`${new URL(p.authorize).origin}/**`, (route) => route.fulfill({ body: "interceptado" }));
        await page.goto(path);
        const [req] = await Promise.all([
          page.waitForRequest((r) => r.url().startsWith(p.authorize)),
          page.getByRole("button", { name: p.button }).click(),
        ]);

        const url = new URL(req.url());
        expect(`${url.origin}${url.pathname}`).toBe(p.authorize);
        expect(url.searchParams.get("client_id")).toBeTruthy();
        expect(url.searchParams.get("redirect_uri")).toBe(`http://localhost:3000/api/auth/callback/${p.id}`);
        expect(url.searchParams.get("response_type")).toBe("code");
        expect(url.searchParams.get("scope")!.split(/[ ,]+/)).toEqual(expect.arrayContaining(p.scopes));
        // Auth.js: GitHub usa PKCE; o provedor LinkedIn declara checks: ["state"].
        if (p.id === "github") {
          expect(url.searchParams.get("code_challenge")).toBeTruthy();
          expect(url.searchParams.get("code_challenge_method")).toBe("S256");
        } else {
          expect(url.searchParams.get("state")).toBeTruthy();
        }
      });
    }
  }
});

test.describe("erros de OAuth voltam para /entrar em português", () => {
  const cases = [
    { name: "acesso negado no provedor", url: "/api/auth/callback/github?error=access_denied", text: "Não foi possível concluir o login" },
    { name: "state inválido", url: "/api/auth/callback/linkedin?code=x&state=invalido", text: "Este login está indisponível" },
    { name: "error=Configuration", url: "/api/auth/error?error=Configuration", text: "Este login está indisponível" },
  ];
  for (const c of cases) {
    test(c.name, async ({ page }) => {
      await page.goto(c.url);
      await expect(page).toHaveURL(/\/entrar\?error=/);
      await expect(page.locator("p[role=alert]")).toContainText(c.text);
      await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    });
  }
});

test.describe("permissões depois do login", () => {
  test("candidato não entra em /recrutamento", async ({ page }) => {
    await register(page, uniqueEmail());
    await expect(page).toHaveURL(/\/vagas$/);
    await page.goto("/recrutamento");
    await expect(page).toHaveURL(/\/vagas$/);
  });

  test("recrutador não entra em /perfil", async ({ page }) => {
    await page.goto("/entrar");
    await login(page, RECRUITER.email, RECRUITER.password);
    await expect(page).toHaveURL(/\/recrutamento$/);
    await page.goto("/perfil");
    await expect(page).toHaveURL(/\/recrutamento$/);
  });
});
