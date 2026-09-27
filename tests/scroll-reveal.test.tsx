import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScrollReveal from "../src/components/scroll-reveal";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

let intersectionCallback!: IntersectionObserverCallback;

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }

  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();
}

const matchMedia = (matches: boolean) =>
  vi.fn(
    () =>
      ({
        matches,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as MediaQueryList,
  );

describe("Revelação durante a rolagem", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal("matchMedia", matchMedia(false));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("repete a animação quando o bloco sai e reentra na viewport", () => {
    render(
      <ScrollReveal>
        <section data-reveal>Conteúdo observado</section>
      </ScrollReveal>,
    );
    const content = screen.getByText("Conteúdo observado");

    act(() => {
      intersectionCallback(
        [
          {
            target: content,
            isIntersecting: true,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });
    expect(content.classList.contains("is-visible")).toBe(true);

    act(() => {
      intersectionCallback(
        [
          {
            target: content,
            isIntersecting: false,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });
    expect(content.classList.contains("is-visible")).toBe(false);

    act(() => {
      intersectionCallback(
        [
          {
            target: content,
            isIntersecting: true,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });
    expect(content.classList.contains("is-visible")).toBe(true);
  });

  it("mantém todo o conteúdo visível com movimento reduzido", () => {
    vi.stubGlobal("matchMedia", matchMedia(true));
    render(
      <ScrollReveal>
        <section data-reveal>Conteúdo sem animação</section>
      </ScrollReveal>,
    );

    const content = screen.getByText("Conteúdo sem animação");
    expect(content.closest(".reveal-ready")).toBeNull();
    expect(content.classList.contains("is-visible")).toBe(false);
  });
});
