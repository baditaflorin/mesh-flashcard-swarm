import { FormEvent, useMemo, useState } from "react";
import {
  MeshNameInput,
  useNamedPeer,
  useSharedCollection,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Flashcard = {
  id: string;
  front: string;
  back: string;
  author: string;
  createdAt: number;
};

type ReviewRound = {
  id: "current-round";
  cardId: string;
  revealed: boolean;
  number: number;
  updatedAt: number;
};

const MAX_CARDS = 60;
const MAX_SIDE_LENGTH = 180;
const validId = (value: unknown) => typeof value === "string" && /^[a-f0-9]{16,64}$/i.test(value);
const validText = (value: unknown, min = 1, max = MAX_SIDE_LENGTH) =>
  typeof value === "string" && value.trim().length >= min && value.trim().length <= max;

/** Reject malformed peer-authored cards at the shared-document boundary. */
export function isValidFlashcard(value: unknown): value is Flashcard {
  const card = value as Partial<Flashcard>;
  return Boolean(
    card &&
    validId(card.id) &&
    validText(card.front, 1) &&
    validText(card.back, 1) &&
    validText(card.author, 1, 32) &&
    Number.isFinite(card.createdAt),
  );
}

export function isValidReviewRound(value: unknown): value is ReviewRound {
  const round = value as Partial<ReviewRound>;
  return Boolean(
    round &&
    round.id === "current-round" &&
    validId(round.cardId) &&
    typeof round.revealed === "boolean" &&
    Number.isInteger(round.number) &&
    (round.number ?? 0) >= 1 &&
    (round.number ?? 0) <= 10_000 &&
    Number.isFinite(round.updatedAt),
  );
}

const cardId = () => crypto.getRandomValues(new Uint32Array(2)).join("").padStart(16, "0");

export function Feature({ room, config }: Props) {
  const { name, setName, myName } = useNamedPeer(config, room);
  const cards = useSharedCollection<Flashcard>(room, "mesh-flashcard-swarm:cards", {
    validate: isValidFlashcard,
  });
  const rounds = useSharedCollection<ReviewRound>(room, "mesh-flashcard-swarm:round", {
    validate: isValidReviewRound,
  });
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const round = rounds.byId("current-round");
  const orderedCards = useMemo(
    () => [...cards.items].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
    [cards.items],
  );
  const currentIndex = round ? orderedCards.findIndex((card) => card.id === round.cardId) : -1;
  const currentCard = currentIndex >= 0 ? orderedCards[currentIndex] : undefined;
  const reviewStatus = !room
    ? "Joining the shared deck…"
    : !orderedCards.length
      ? "Add the first card to begin a shared review."
      : !round || !currentCard
        ? "The deck is ready. Start a review round."
        : round.revealed
          ? `Answer revealed for round ${round.number}. Choose the next shared card when ready.`
          : `Round ${round.number}: read the prompt, think of the answer, then reveal it.`;

  const addCard = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!myName || !validText(front) || !validText(back) || cards.items.length >= MAX_CARDS) return;
    if (
      cards.add({
        id: cardId(),
        front: front.trim(),
        back: back.trim(),
        author: myName,
        createdAt: Date.now(),
      })
    ) {
      setFront("");
      setBack("");
    }
  };

  const startRound = () => {
    const first = orderedCards[0];
    if (!first || round) return;
    rounds.add({
      id: "current-round",
      cardId: first.id,
      revealed: false,
      number: 1,
      updatedAt: Date.now(),
    });
  };

  const reveal = () =>
    round && rounds.update("current-round", { revealed: true, updatedAt: Date.now() });
  const next = () => {
    if (!round || !orderedCards.length) return;
    const nextCard = orderedCards[(Math.max(currentIndex, 0) + 1) % orderedCards.length];
    if (!nextCard) return;
    rounds.update("current-round", {
      cardId: nextCard.id,
      revealed: false,
      number: round.number + 1,
      updatedAt: Date.now(),
    });
  };

  if (!room) {
    return (
      <main className="swarm" aria-labelledby="swarm-title">
        <p className="eyebrow">Peer-authored review room</p>
        <h1 id="swarm-title">Flashcard swarm</h1>
        <p role="status">Joining the shared deck…</p>
      </main>
    );
  }

  return (
    <main className="swarm" aria-labelledby="swarm-title">
      <header className="swarm__hero">
        <p className="eyebrow">Peer-authored review room</p>
        <h1 id="swarm-title">Flashcard swarm</h1>
        <p className="lede">
          Build a tiny deck together, then move through one shared review round at a time.
        </p>
      </header>

      <section className="review" aria-labelledby="review-title">
        <div className="review__bar">
          <div>
            <p className="eyebrow">Shared review</p>
            <h2 id="review-title">
              {currentCard ? `Round ${round?.number}` : "Ready when the deck is"}
            </h2>
          </div>
          {!round || !currentCard ? (
            <button type="button" onClick={startRound} disabled={!orderedCards.length}>
              Start shared review
            </button>
          ) : round.revealed ? (
            <button type="button" onClick={next}>
              Next shared card
            </button>
          ) : (
            <button type="button" onClick={reveal}>
              Reveal answer
            </button>
          )}
        </div>
        <p className="review__status" role="status" aria-live="polite">
          {reviewStatus}
        </p>
        {currentCard ? (
          <article className={`review-card${round?.revealed ? " review-card--revealed" : ""}`}>
            <p className="review-card__label">Prompt</p>
            <h3>{currentCard.front}</h3>
            {round?.revealed ? (
              <>
                <p className="review-card__label">Answer</p>
                <p className="review-card__answer">{currentCard.back}</p>
              </>
            ) : (
              <p className="review-card__hint">
                Pause here and recall the answer before revealing it.
              </p>
            )}
            <p className="review-card__author">Added by {currentCard.author}</p>
          </article>
        ) : (
          <div className="review-card review-card--empty">
            <p>Shared review stays lightweight: add a card below, then begin together.</p>
          </div>
        )}
      </section>

      <div className="swarm__grid">
        <section className="composer" aria-labelledby="composer-title">
          <p className="eyebrow">Add to the room</p>
          <h2 id="composer-title">Create a flashcard</h2>
          <form onSubmit={addCard}>
            <label>
              Prompt
              <textarea
                value={front}
                onChange={(event) => setFront(event.target.value)}
                maxLength={MAX_SIDE_LENGTH}
                required
                placeholder="What should everyone recall?"
              />
            </label>
            <label>
              Answer
              <textarea
                value={back}
                onChange={(event) => setBack(event.target.value)}
                maxLength={MAX_SIDE_LENGTH}
                required
                placeholder="Write a clear, short answer."
              />
            </label>
            <button type="submit" disabled={!myName || cards.items.length >= MAX_CARDS}>
              Add shared card
            </button>
          </form>
          <p className="form-note">
            {cards.items.length}/{MAX_CARDS} cards. Your display name is attached to cards you add.
          </p>
        </section>

        <section className="deck" aria-labelledby="deck-title">
          <p className="eyebrow">Room deck</p>
          <h2 id="deck-title">
            {orderedCards.length} shared {orderedCards.length === 1 ? "card" : "cards"}
          </h2>
          <ol>
            {orderedCards.length ? (
              orderedCards.map((card) => (
                <li key={card.id}>
                  <strong>{card.front}</strong>
                  <span>{card.back}</span>
                  <small>by {card.author}</small>
                </li>
              ))
            ) : (
              <li className="deck__empty">No cards yet. Add one to make this deck useful.</li>
            )}
          </ol>
        </section>
      </div>

      <section className="identity" aria-label="Your local display name">
        <div>
          <p className="eyebrow">Your local display name</p>
          <p>
            {myName
              ? `${myName} can add cards to this room.`
              : "Add a name before contributing a card."}
          </p>
        </div>
        <MeshNameInput
          value={name}
          onChange={setName}
          ariaLabel="Your display name"
          placeholder="Your name"
          maxLength={32}
        />
      </section>
      <footer className="privacy-note">
        Cards and review state sync directly among browsers in this room. No accounts, trackers, or
        server-stored deck are required.
      </footer>
    </main>
  );
}
