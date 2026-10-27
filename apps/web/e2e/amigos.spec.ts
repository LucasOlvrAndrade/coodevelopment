import { expect, test } from "@playwright/test";

// Com sessão, depende da branch de teste do Neon (pendente desde a Story 1.2);
// as regras e a tela estão cobertas nos testes de unidade e de componente.
test("sem sessão, Amigos volta para a página inicial", async ({ page }) => {
  await page.goto("/amigos");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Entrar com GitHub" })).toBeVisible();
});
