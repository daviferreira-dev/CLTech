import { describe, expect, it } from "vitest";
import { parseGithubProfile, parseLattesProfile, parseLinkedinProfile } from "@/lib/external-profiles";

describe("parseGithubProfile", () => {
  it.each([
    ["octocat", "octocat"],
    ["@octocat", "octocat"],
    ["github.com/octocat", "octocat"],
    ["https://github.com/octocat", "octocat"],
    ["https://www.github.com/octo-cat/", "octo-cat"],
    ["https://github.com/octocat/hello-world", "octocat"],
    ["  https://github.com/octocat?tab=repositories  ", "octocat"],
  ])("aceita %s", (input, username) => {
    expect(parseGithubProfile(input)).toEqual({ username, url: `https://github.com/${username}` });
  });

  it.each(["", "   ", "-octocat", "octo--cat", "a".repeat(40), "https://gitlab.com/octocat", "https://github.com/", "https://github.com/settings", "octo cat"])(
    "rejeita %s",
    (input) => {
      expect(parseGithubProfile(input)).toBeNull();
    },
  );
});

describe("parseLinkedinProfile", () => {
  it.each([
    ["joao-silva", "joao-silva"],
    ["linkedin.com/in/joao-silva", "joao-silva"],
    ["https://www.linkedin.com/in/joao-silva/", "joao-silva"],
    ["https://br.linkedin.com/in/joao-silva-123abc?originalSubdomain=br", "joao-silva-123abc"],
    ["https://www.linkedin.com/in/jo%C3%A3o-silva", "joão-silva"],
  ])("aceita %s", (input, username) => {
    const parsed = parseLinkedinProfile(input);
    expect(parsed?.username).toBe(username);
    expect(parsed?.url).toBe(`https://www.linkedin.com/in/${encodeURIComponent(username)}`);
  });

  it.each(["", "ab", "https://www.linkedin.com/company/acme", "https://www.linkedin.com/", "https://evil.com/in/joao", "https://linkedin.com.evil.com/in/joao"])(
    "rejeita %s",
    (input) => {
      expect(parseLinkedinProfile(input)).toBeNull();
    },
  );
});

describe("parseLattesProfile", () => {
  it("aceita link curto e link do buscatextual", () => {
    expect(parseLattesProfile("http://lattes.cnpq.br/1234567890123456")?.username).toBe("1234567890123456");
    expect(parseLattesProfile("https://buscatextual.cnpq.br/buscatextual/visualizacv.do?id=K1234567A8")?.username).toBe("K1234567A8");
  });

  it("rejeita outros domínios", () => {
    expect(parseLattesProfile("https://example.com/1234")).toBeNull();
    expect(parseLattesProfile("")).toBeNull();
  });
});
