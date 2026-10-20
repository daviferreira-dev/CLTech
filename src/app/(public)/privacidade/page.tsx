import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui";

export const metadata: Metadata = { title: "Aviso de privacidade — CLTech" };

// Spec 006, US6 / FR-307 — LGPD art. 9º: finalidade, forma, duração, quem acessa e como
// exercer os direitos. O conteúdo descreve o que o código faz hoje; mudar um sem o outro
// torna o aviso falso.
const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Quais dados tratamos",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Conta: nome, e-mail e senha (guardada só como hash Argon2id).</li>
        <li>Perfil: telefone, cidade e estado.</li>
        <li>Currículo enviado e o texto extraído dele.</li>
        <li>Contas externas que você conecta: usuário do GitHub e dados públicos do portfólio; links do LinkedIn e Lattes.</li>
        <li>Candidaturas, etapas do processo e o código que você escreve nos desafios técnicos.</li>
      </ul>
    ),
  },
  {
    title: "Para quê",
    body: (
      <p>
        Exclusivamente para os processos seletivos da 3aq Tecnologia: calcular a compatibilidade com as vagas, corrigir
        os desafios técnicos e permitir que a equipe de recrutamento avalie sua candidatura. A base legal é a execução de
        procedimentos preliminares a um contrato, a seu pedido (LGPD, art. 7º, V). Nenhum dado é enviado a serviço de
        inteligência artificial de terceiros: a triagem roda dentro da própria plataforma.
      </p>
    ),
  },
  {
    title: "Quem acessa",
    body: (
      <p>
        Só você e usuários da 3aq com papel de Recrutador ou Administrador. O papel é verificado no servidor a cada acesso.
        Outros candidatos nunca veem seus dados.
      </p>
    ),
  },
  {
    title: "Como protegemos",
    body: (
      <p>
        Todo o tráfego é feito por HTTPS. Telefone, currículo (arquivo e texto) e o código dos desafios ficam cifrados com
        AES-256 no banco e no armazenamento de arquivos, que é privado e só entrega o currículo por link temporário de 60
        segundos. Nome e e-mail ficam protegidos por controle de acesso, porque precisam ser pesquisáveis e únicos.
      </p>
    ),
  },
  {
    title: "Por quanto tempo",
    body: (
      <p>
        Enquanto sua conta existir. Ao excluí-la, todos os dados acima são apagados de forma definitiva, inclusive os
        arquivos de currículo.
      </p>
    ),
  },
  {
    title: "Seus direitos",
    body: (
      <p>
        Em <a href="/perfil" className="underline underline-offset-2">Meu Perfil</a> você corrige seus dados, baixa uma
        cópia de tudo o que guardamos (&ldquo;Baixar meus dados&rdquo;) e exclui sua conta (&ldquo;Excluir minha
        conta&rdquo;), sem precisar pedir a ninguém.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Aviso de privacidade" subtitle="Como a CLTech trata seus dados pessoais, conforme a LGPD." />
      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <Card as="section" key={section.title}>
            <CardBody className="space-y-2 text-body text-ink-600">
              <h2 className="text-h3 text-ink-900">{section.title}</h2>
              {section.body}
            </CardBody>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
