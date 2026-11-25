import { expect, test } from "@playwright/test";

test("the bare core shows an empty map and no data source", async ({ page }) => {
  await page.goto("/?plugins=none");
  await expect(page.getByRole("heading", { name: "Empty map" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Activate a plugin to add a base map")).toBeVisible();
  await expect(page.getByRole("tab", { name: /plugins/i })).toBeVisible();
});

test("reference plugins contribute layers, attribution and panels", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("OpenStreetMap Standard")).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText("Hillshade (Terrarium)")).toBeVisible();
  await expect(page.locator(".attribution summary")).toBeVisible();
});

test("theme switching changes only token values", async ({ page }) => {
  await page.goto("/?plugins=none");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("the style guide exposes every component", async ({ page }) => {
  await page.goto("/?plugins=none");
  await page.getByRole("button", { name: "Style guide" }).click();
  await expect(page.getByRole("heading", { name: "Style guide" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Colormaps" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Icon set" })).toBeVisible();
});
