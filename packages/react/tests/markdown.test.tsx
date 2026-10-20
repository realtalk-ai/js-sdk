import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "../src/components/Markdown.js";

describe("Markdown", () => {
  it("renders markdown links as links that open in a new tab", () => {
    const { getByRole } = render(
      <Markdown>
        {"Läs mer på [vår sida](https://example.com/a?b=1&c=2)."}
      </Markdown>,
    );

    const link = getByRole("link", { name: "vår sida" });
    expect(link.getAttribute("href")).toBe("https://example.com/a?b=1&c=2");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("renders lists and bold text", () => {
    const { container } = render(<Markdown>{"- **boka**\n- avboka"}</Markdown>);

    const items = container.querySelectorAll("li");
    expect([...items].map((item) => item.textContent)).toEqual([
      "boka",
      "avboka",
    ]);
    expect(container.querySelector("li strong")?.textContent).toBe("boka");
  });

  it("renders the label of a link that is still being written", () => {
    const { container } = render(
      <Markdown>{"Se [priser](https://example.com/p"}</Markdown>,
    );

    expect(container.textContent).toBe("Se priser");
    expect(container.textContent).not.toContain("https://");
  });

  it("leaves out an image whose URL is still being written", () => {
    const { container } = render(
      <Markdown>{"Se ![karta](https://example.com/k"}</Markdown>,
    );

    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps single line breaks", () => {
    const { container } = render(<Markdown>{"Hej!\nVälkommen."}</Markdown>);

    expect(container.querySelectorAll("p br")).toHaveLength(1);
  });

  it("always adds the rt-markdown class before the given className", () => {
    const { container: plain } = render(<Markdown>{"Hej!"}</Markdown>);
    const { container: custom } = render(
      <Markdown className="chat">{"Hej!"}</Markdown>,
    );

    expect((plain.firstChild as HTMLElement).className).toBe("rt-markdown");
    expect((custom.firstChild as HTMLElement).className).toBe(
      "rt-markdown chat",
    );
  });
});
