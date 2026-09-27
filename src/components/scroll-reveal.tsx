"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function ScrollReveal({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const container = root.current;
    if (!container) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) return;

    let lastScrollY = window.scrollY;
    let animationFrame = 0;
    container.dataset.scrollDirection = "down";
    container.classList.add("reveal-ready");

    const updateDirection = () => {
      const currentScrollY = window.scrollY;
      if (Math.abs(currentScrollY - lastScrollY) > 2) {
        container.dataset.scrollDirection =
          currentScrollY > lastScrollY ? "down" : "up";
        lastScrollY = currentScrollY;
      }
      animationFrame = 0;
    };
    const onScroll = () => {
      if (!animationFrame)
        animationFrame = requestAnimationFrame(updateDirection);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-visible", entry.isIntersecting);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    const observeContent = () => {
      container
        .querySelectorAll<HTMLElement>("[data-reveal]")
        .forEach((element) => observer.observe(element));
    };
    const mutationObserver = new MutationObserver(observeContent);

    observeContent();
    mutationObserver.observe(container, { childList: true, subtree: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      mutationObserver.disconnect();
      observer.disconnect();
      container.classList.remove("reveal-ready");
      delete container.dataset.scrollDirection;
      container
        .querySelectorAll<HTMLElement>("[data-reveal]")
        .forEach((element) => element.classList.remove("is-visible"));
    };
  }, [pathname]);

  return (
    <div ref={root} className="reveal-root">
      {children}
    </div>
  );
}
