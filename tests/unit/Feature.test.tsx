import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMockRoom } from "@baditaflorin/mesh-common/testing";
import { Feature, isValidFlashcard, isValidReviewRound } from "../../src/Feature";
import { config } from "../../src/config";

describe("Feature (component)", () => {
  it("renders the accessible review and deck when connected", () => {
    const room = createMockRoom();
    render(<Feature room={room} config={config} />);
    expect(screen.getByRole("heading", { name: "Flashcard swarm" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /shared cards/i })).toBeInTheDocument();
  });

  it("shows a connecting state when room is null", () => {
    render(<Feature room={null} config={config} />);
    expect(screen.getByRole("status")).toHaveTextContent("Joining the shared deck");
  });

  it("accepts bounded shared card and review shapes only", () => {
    expect(
      isValidFlashcard({
        id: "a1b2c3d4e5f60708",
        front: "Prompt",
        back: "Answer",
        author: "Ari",
        createdAt: Date.now(),
      }),
    ).toBe(true);
    expect(
      isValidFlashcard({
        id: "bad",
        front: "",
        back: "Answer",
        author: "Ari",
        createdAt: Date.now(),
      }),
    ).toBe(false);
    expect(
      isValidReviewRound({
        id: "current-round",
        cardId: "a1b2c3d4e5f60708",
        revealed: false,
        number: 1,
        updatedAt: Date.now(),
      }),
    ).toBe(true);
    expect(
      isValidReviewRound({
        id: "current-round",
        cardId: "bad",
        revealed: "no",
        number: 0,
        updatedAt: 0,
      }),
    ).toBe(false);
  });
});
