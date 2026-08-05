import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SelfViewControlsOverlay } from "../../components/SelfViewControlsOverlay";
import type { LocalCameraMode } from "../../components/LocalCameraSurface";

vi.mock("../../hooks/useLayoutMorph", () => ({
  useLayoutMorph: vi.fn(),
}));

describe("SelfViewControlsOverlay", () => {
  it("stays mounted and measurable in fullscreen with the Flip pill hidden", () => {
    const { getByTestId, queryByTestId } = render(
      <SelfViewControlsOverlay
        mode="fullscreen"
        morphDurationMs={200}
        flipVisible={false}
        onFlip={() => undefined}
      />,
    );

    const overlay = getByTestId("self-view-controls-overlay");
    expect(overlay).toBeTruthy();
    expect(overlay.getAttribute("data-mode")).toBe("fullscreen");
    expect(overlay.getBoundingClientRect).toBeTypeOf("function");

    const flip = queryByTestId("self-flip");
    expect(flip).not.toBeNull();
    expect(flip?.getAttribute("data-visible")).toBe("false");
  });

  it.each([
    "expanded",
    "compact",
    "fullscreen",
  ] as LocalCameraMode[])("receives data-mode=%s without DOMRect inline coords", (mode) => {
    const style = { top: 100, left: 40, right: "auto" as const };
    const { getByTestId } = render(
      <SelfViewControlsOverlay
        mode={mode}
        style={style}
        morphDurationMs={180}
        flipVisible={mode === "expanded"}
        onFlip={() => undefined}
      />,
    );

    const overlay = getByTestId("self-view-controls-overlay");
    expect(overlay.getAttribute("data-mode")).toBe(mode);
    expect((overlay as HTMLElement).style.top).toBe("100px");
    expect((overlay as HTMLElement).style.left).toBe("40px");

    const flip = getByTestId("self-flip") as HTMLElement;
    // Bottom-anchored via CSS — no getBoundingClientRect-derived top/left.
    expect(flip.style.top).toBe("");
    expect(flip.style.left).toBe("");
  });

  it("anchors the Flip pill with a 13px symbol", () => {
    const { getByTestId } = render(
      <SelfViewControlsOverlay
        mode="expanded"
        morphDurationMs={180}
        flipVisible
        onFlip={() => undefined}
      />,
    );
    const flip = getByTestId("self-flip");
    const symbol = flip.querySelector(".symbol-icon") as HTMLElement;
    expect(symbol.style.height).toBe("13px");
  });
});
