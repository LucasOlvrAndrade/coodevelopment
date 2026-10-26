import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const temas = ["light", "dark"] as const;
const larguras = [{ nome: "computador", width: 1280, height: 800 }, { nome: "celular", width: 360, height: 740 }];

test.describe("página inicial", () => {
  for (const tema of temas) {
    for (const tela of larguras) {
      test(`passa no axe (WCAG AA), tema ${tema}, ${tela.nome}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: tema });
        await page.setViewportSize(tela);
        await page.goto("/");
        await expect(page.getByRole("button", { name: "Entrar com GitHub" })).toBeEnabled();
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
        const largura = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(largura).toBeLessThanOrEqual(tela.width);
      });
    }
  }

  test("o aviso de recusa no GitHub passa no axe", async ({ page }) => {
    await page.goto("/?erro=github");
    await expect(page.getByRole("alert")).toContainText("precisa da sua autorização no GitHub");
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });

  test("Entrar com GitHub manda para a autorização do GitHub App", async ({ page }) => {
    await page.route("https://github.com/**", (rota) => rota.fulfill({ status: 200, body: "github" }));
    const indo = page.waitForRequest((r) => r.url().startsWith("https://github.com/login/oauth/authorize"));
    await page.goto("/");
    await page.getByRole("button", { name: "Entrar com GitHub" }).click();
    const url = new URL((await indo).url());
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/callback/github");
    expect(url.searchParams.get("state")).toBeTruthy();
  });
});

test("sem sessão, o Início volta para a página inicial", async ({ page }) => {
  await page.goto("/inicio");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Entrar com GitHub" })).toBeVisible();
});
