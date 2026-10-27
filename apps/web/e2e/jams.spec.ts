import { expect, test } from "@playwright/test";

// Com sessão, depende da branch de teste do Neon (pendente desde a Story 1.2).
test("sem sessão, Nova jam volta para a página inicial", async ({ page }) => {
  await page.goto("/jams/nova");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Entrar com GitHub" })).toBeVisible();
});
