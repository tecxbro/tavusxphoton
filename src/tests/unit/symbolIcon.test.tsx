import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SymbolIcon, type SymbolName } from "../../components/SymbolIcon";
import { SYMBOL_METRICS } from "../../lib/symbolMetrics";

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
    const { container } = render(<SymbolIcon name={name} />);
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

  it("resolves dimensions per symbol instead of one shared size", () => {
    const { container } = render(
      <>
        <SymbolIcon name="camera-on" />
        <SymbolIcon name="microphone-on" />
        <SymbolIcon name="more" />
        <SymbolIcon name="end-call" />
      </>,
    );
    const [camera, mic, more, end] = Array.from(
      container.querySelectorAll<HTMLElement>(".symbol-icon"),
    );

    expect(camera.style.width).toBe(`${SYMBOL_METRICS["camera-on"].width}px`);
    expect(camera.style.height).toBe(`${SYMBOL_METRICS["camera-on"].height}px`);
    expect(mic.style.width).toBe(`${SYMBOL_METRICS["microphone-on"].width}px`);
    expect(mic.style.height).toBe(
      `${SYMBOL_METRICS["microphone-on"].height}px`,
    );
    expect(more.style.height).toBe(`${SYMBOL_METRICS.more.height}px`);
    expect(end.style.width).toBe(`${SYMBOL_METRICS["end-call"].width}px`);

    const signatures = new Set(
      [camera, mic, more, end].map((el) => `${el.style.width}x${el.style.height}`),
    );
    expect(signatures.size).toBeGreaterThan(2);
  });

  it("scales proportionally when size overrides the optical height", () => {
    const { container } = render(<SymbolIcon name="camera-on" size={40} />);
    const icon = container.querySelector<HTMLElement>(".symbol-icon");
    expect(icon?.style.height).toBe("40px");
    expect(icon?.style.width).toBe("60px");
  });

  it("marks each symbol with its data-symbol name", () => {
    const { container } = render(<SymbolIcon name="microphone-off" />);
    const icon = container.querySelector(".symbol-icon");
    expect(icon?.getAttribute("data-symbol")).toBe("microphone-off");
  });
});
