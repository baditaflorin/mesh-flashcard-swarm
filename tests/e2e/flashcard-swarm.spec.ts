import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";

test("a peer-authored card and shared answer propagate to another browser", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", {
    storagePrefix: "mesh-flashcard-swarm",
  });
  try {
    await a.getByLabel("Your display name").fill("Ari");
    await b.getByLabel("Your display name").fill("Bea");
    await a.getByLabel("Prompt").fill("What is the chemical symbol for water?");
    await a.getByLabel("Answer").fill("H₂O");
    await a.getByRole("button", { name: "Add shared card" }).click();
    await expect(
      b.getByText("What is the chemical symbol for water?", { exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await b.getByRole("button", { name: "Start shared review" }).click();
    await expect(a.getByRole("button", { name: "Reveal answer" })).toBeVisible({ timeout: 10_000 });
    await a.getByRole("button", { name: "Reveal answer" }).click();
    await expect(b.locator(".review-card__answer")).toHaveText("H₂O", { timeout: 10_000 });
  } finally {
    await cleanup();
  }
});
