import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SymbolIcon, type SymbolName } from "../../components/SymbolIcon";

const SYMBOL_NAMES: SymbolName[] = [
  "camera-on",
  "camera-off",
  "microphone-on",
  "microphone-off",
  "end-call",
  "flip-camera",
  "effects",
  "contact-chevron",
  "more",
];

describe("SymbolIcon", () => {
  it.each(SYMBOL_NAMES)("renders inline SVG for %s", (name) => {
    const { container } = render(<SymbolIcon name={name} size={24} />);
    const icon = container.querySelector(".symbol-icon");
    expect(icon).not.toBeNull();

    const svg = icon?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBeTruthy();
    expect(svg?.querySelectorAll("path").length).toBeGreaterThan(0);

    expect((icon as HTMLElement).style.getPropertyValue("--symbol-mask")).toBe(
      "",
    );
    expect(icon?.querySelector("img")).toBeNull();
  });
});
