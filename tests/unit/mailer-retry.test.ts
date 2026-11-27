import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: send }) } }));

const msg = { to: "a@b.c", subject: "s", html: "<p>x</p>", text: "x" };

async function load() {
  vi.resetModules();
  return import("@/server/email/mailer");
}

describe("sendMail com nova tentativa", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    send.mockReset();
    vi.stubEnv("SMTP_HOST", "h");
    vi.stubEnv("SMTP_USER", "u");
    vi.stubEnv("SMTP_PASS", "p");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("envia uma vez quando dá certo", async () => {
    send.mockResolvedValue({});
    const { sendMail } = await load();
    await sendMail(msg);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("tenta de novo após falha temporária e para no sucesso", async () => {
    send.mockRejectedValueOnce(new Error("rede")).mockResolvedValue({});
    const { sendMail } = await load();
    const p = sendMail(msg);
    await vi.runAllTimersAsync();
    await p;
    expect(send).toHaveBeenCalledTimes(2);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("desiste após 3 tentativas, loga sem a mensagem do erro e não lança", async () => {
    send.mockRejectedValue(new Error("falha com a@b.c"));
    const { sendMail } = await load();
    const p = sendMail(msg);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(3);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(String((console.error as any).mock.calls[0][0])).not.toContain("a@b.c");
  });

  it("não repete erro definitivo (5xx do SMTP)", async () => {
    send.mockRejectedValue(Object.assign(new Error("auth"), { responseCode: 535 }));
    const { sendMail } = await load();
    await sendMail(msg);
    expect(send).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
