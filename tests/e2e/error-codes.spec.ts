// Spec 004 SC-103: cada código de erro do vocabulário vira um próximo passo na tela.
// Códigos que dependem de corrida entre duas pessoas (vaga fechada entre o carregar e o
// clicar, outro recrutador decidindo antes) são produzidos interceptando a resposta da API:
// o que se testa aqui é a tradução do código em ação, não a regra do servidor — essa já tem
// teste de integração.
import { test, expect, type Page } from "@playwright/test";
import { chooseOption } from "./fixtures/select";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function uniqueEmail(prefix: string) {
  return `e2e-${prefix}-${Date.now()}@example.com`;
}

async function signUpWithResume(page: Page, prefix: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill(`Pessoa ${prefix}`);
  await page.getByLabel("E-mail").fill(uniqueEmail(prefix));
  await page.getByLabel("Senha", { exact: true }).fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/vagas$/);
  await page.goto("/perfil");
  await page.setInputFiles('input[type="file"]', path.join(__dirname, "fixtures", "cv-valido.pdf"));
  await expect(page.getByText(/cv-valido\.pdf/)).toBeVisible();
}

async function loginAsRecruiter(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("recrutador@3aq.dev");
  await page.getByLabel("Senha", { exact: true }).fill("Senha123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/recrutamento$/);
}

function fulfillError(status: number, code: string, message = "erro simulado") {
  return { status, contentType: "application/json", body: JSON.stringify({ error: { code, message } }) };
}

test("ALREADY_APPLIED vira 'Candidatura enviada' com link para acompanhar", async ({ page }) => {
  await signUpWithResume(page, "already");
  await page.goto("/vagas");
  await page.locator('a[href^="/vagas/"]').first().click();
  await expect(page).toHaveURL(/\/vagas\/.+/);
  const jobUrl = page.url();

  // Candidatura feita em outra aba depois que esta carregou: o botão ainda aparece e a API
  // responde ALREADY_APPLIED.
  await page.route("**/api/jobs/*/apply", (route) => route.fulfill(fulfillError(409, "ALREADY_APPLIED")));
  await page.getByRole("button", { name: "Candidatar-se" }).click();
  await expect(page.getByText("Candidatura enviada")).toBeVisible();
  await expect(page.getByRole("link", { name: "Acompanhar candidatura" })).toHaveAttribute("href", "/candidaturas");
  await page.unroute("**/api/jobs/*/apply");

  // Candidatura real: ao voltar à vaga, o acompanhamento já aparece no lugar do botão.
  await page.goto(jobUrl);
  await page.getByRole("button", { name: "Candidatar-se" }).click();
  await expect(page).toHaveURL(/\/candidaturas\?nova=/);
  await page.goto(jobUrl);
  await expect(page.getByText("Candidatura enviada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Candidatar-se" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Acompanhar candidatura" })).toHaveAttribute("href", "/candidaturas");
});

test("RESUME_REQUIRED oferece enviar currículo e voltar à vaga", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Pessoa Sem CV");
  await page.getByLabel("E-mail").fill(uniqueEmail("nocv"));
  await page.getByLabel("Senha", { exact: true }).fill("senhaSegura123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/vagas$/);

  await page.locator('a[href^="/vagas/"]').first().click();
  await expect(page).toHaveURL(/\/vagas\/.+/);
  const jobPath = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Candidatar-se" }).click();
  await expect(page.getByText(/Complete seu perfil com um currículo/)).toBeVisible();

  // O cartão de tecnologias também oferece o envio; a ação da candidatura é a da coluna lateral.
  await page.getByRole("complementary", { name: "Candidatura" }).getByRole("link", { name: "Enviar currículo" }).click();
  await expect(page).toHaveURL(`/perfil?next=${encodeURIComponent(jobPath)}`);
  await page.setInputFiles('input[type="file"]', path.join(__dirname, "fixtures", "cv-valido.pdf"));
  await page.getByRole("link", { name: "Voltar à vaga" }).click();
  await expect(page).toHaveURL(new RegExp(`${jobPath}$`));
});

test("JOB_NOT_OPEN informa que a vaga fechou e leva de volta às vagas", async ({ page }) => {
  await signUpWithResume(page, "notopen");
  await page.goto("/vagas");
  await page.locator('a[href^="/vagas/"]').first().click();
  await page.route("**/api/jobs/*/apply", (route) => route.fulfill(fulfillError(422, "JOB_NOT_OPEN")));
  await page.getByRole("button", { name: "Candidatar-se" }).click();
  await expect(page.getByText("Esta vaga não está mais aberta para candidaturas.")).toBeVisible();
  await page.getByRole("link", { name: "Voltar às vagas" }).click();
  await expect(page).toHaveURL(/\/vagas$/);
});

test("401 numa ação leva ao login e volta ao mesmo ponto (US7.1)", async ({ page }) => {
  await signUpWithResume(page, "expired");
  await page.goto("/vagas");
  await page.locator('a[href^="/vagas/"]').first().click();
  await expect(page).toHaveURL(/\/vagas\/.+/);
  const jobPath = new URL(page.url()).pathname;
  await page.route("**/api/jobs/*/apply", (route) => route.fulfill(fulfillError(401, "UNAUTHENTICATED")));
  await page.getByRole("button", { name: "Candidatar-se" }).click();
  await expect(page).toHaveURL(new RegExp(`/entrar\\?callbackUrl=${encodeURIComponent(jobPath)}`));
});

test("NOT_AVAILABLE_YET: desafio fora da etapa CODE_TEST volta para as candidaturas", async ({ page }) => {
  await signUpWithResume(page, "notyet");
  await page.goto("/vagas");
  await page.locator('a[href^="/vagas/"]').first().click();
  await page.getByRole("button", { name: "Candidatar-se" }).click();
  await expect(page).toHaveURL(/\/candidaturas\?nova=/);
  const applicationId = new URL(page.url()).searchParams.get("nova");

  await page.goto(`/desafios/${applicationId}`);
  await expect(page).toHaveURL(/\/candidaturas\?desafio=indisponivel/);
  await expect(page.getByText("Desafio indisponível")).toBeVisible();
});

test.describe("recrutador", () => {
  async function createDraftWithStage(page: Page) {
    await page.goto("/recrutamento/vagas/nova");
    await page.getByLabel("Título").fill(`Vaga Erros ${Date.now()}`);
    await page.getByLabel("Descrição").fill("Descrição.");
    await page.getByLabel("Empresa").fill("3aq");
    await page.getByLabel("Localização").fill("Remoto");
    await page.getByLabel("Tecnologias exigidas (separadas por vírgula)").fill("Go");
    await page.getByLabel("Requisitos mínimos").fill("Go.");
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(page).toHaveURL(/\/recrutamento\/vagas\/[^/]+$/);
    await chooseOption(page.getByLabel("Tipo de etapa"), "Análise de Currículo");
    await page.getByRole("button", { name: "Adicionar etapa" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Análise de Currículo" })).toBeVisible();
  }

  test("ALREADY_PUBLISHED recarrega o estado em vez de publicar de novo", async ({ page }) => {
    await loginAsRecruiter(page);
    await createDraftWithStage(page);
    await page.route("**/api/recruiter/jobs/*/publish", (route) => route.fulfill(fulfillError(409, "ALREADY_PUBLISHED")));
    await page.getByRole("button", { name: "Publicar Vaga" }).click();
    await page.getByRole("button", { name: "Confirmar publicação" }).click();
    await expect(page.getByText("Esta vaga já estava publicada.", { exact: false })).toBeVisible();
  });

  test("JOB_LOCKED explica o que ainda pode ser editado", async ({ page }) => {
    await loginAsRecruiter(page);
    await createDraftWithStage(page);
    await page.route("**/api/recruiter/jobs/*/stages", (route) => route.fulfill(fulfillError(409, "JOB_LOCKED")));
    await chooseOption(page.getByLabel("Tipo de etapa"), "Entrevista Técnica");
    await page.getByRole("button", { name: "Adicionar etapa" }).click();
    await expect(page.getByText("Pipeline travado")).toBeVisible();
    await expect(page.getByText(/continuam editáveis/)).toBeVisible();
  });

  test("INCOMPLETE_JOB aponta a etapa de teste de código sem desafio", async ({ page }) => {
    await loginAsRecruiter(page);
    await createDraftWithStage(page);
    await chooseOption(page.getByLabel("Tipo de etapa"), "Teste de Código");
    await page.getByRole("button", { name: "Adicionar etapa" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Teste de Código" })).toBeVisible();
    await page.getByRole("button", { name: "Publicar Vaga" }).click();
    await page.getByRole("button", { name: "Confirmar publicação" }).click();
    await expect(page.getByText("Faltam dados para publicar")).toBeVisible();
    await expect(page.getByText(/configuração do teste de código|o desafio, as linguagens e o tempo/)).toBeVisible();
  });

  test("APPLICATION_CLOSED recarrega a candidatura em vez de insistir", async ({ page }) => {
    await loginAsRecruiter(page);
    await page.goto("/recrutamento/vagas");
    await page.getByRole("link", { name: "Vaga Encerrada — Suporte Técnico" }).first().click();
    await expect(page).toHaveURL(/\/recrutamento\/vagas\/[^/]+$/);
    await page.goto(page.url() + "/candidaturas");
    await page.getByRole("link", { name: "Candidato Demo" }).click();
    await expect(page.getByRole("heading", { name: "Candidato Demo" })).toBeVisible();

    await page.route("**/api/recruiter/applications/*/decision", (route) => route.fulfill(fulfillError(409, "APPLICATION_CLOSED")));
    await page.getByRole("button", { name: "Reprovar" }).click();
    await page.getByRole("button", { name: "Confirmar reprovação" }).click();
    await expect(page.getByText("já foi decidida por outra pessoa", { exact: false })).toBeVisible();
  });
});
