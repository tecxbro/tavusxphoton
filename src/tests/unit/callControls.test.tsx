import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CallControlRail } from "../../components/CallControlRail";
import { ContactPill } from "../../components/ContactPill";
import { EffectsButton } from "../../components/EffectsButton";

const callCss = readFileSync(
  resolve(__dirname, "../../styles/call.css"),
  "utf8",
);
const globalCss = readFileSync(
  resolve(__dirname, "../../styles/global.css"),
  "utf8",
);

function renderRail(overrides: Partial<Parameters<typeof CallControlRail>[0]>) {
  const props = {
    videoEnabled: true,
    audioEnabled: true,
    onToggleCamera: vi.fn(),
    onToggleMic: vi.fn(),
    onEnd: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<CallControlRail {...props} />) };
}

describe("CallControlRail structure", () => {
  it("camera button stays a LiquidGL target in enabled and disabled states", () => {
    const { getByTestId, rerender, props } = renderRail({});
    const camera = getByTestId("toggle-camera");

    expect(camera.classList.contains("liquidGL")).toBe(true);
    expect(camera.getAttribute("data-control")).toBe("camera");
    expect(camera.getAttribute("data-active")).toBe("true");
    expect(camera.querySelector(".control-btn__solid")).not.toBeNull();
    expect(camera.querySelector("[data-symbol='camera-on']")).not.toBeNull();

    rerender(<CallControlRail {...props} videoEnabled={false} />);
    expect(camera.classList.contains("liquidGL")).toBe(true);
    expect(camera.getAttribute("data-active")).toBe("false");
    expect(camera.querySelector(".control-btn__solid")).not.toBeNull();
    expect(camera.querySelector("[data-symbol='camera-off']")).not.toBeNull();
  });

  it("microphone button stays a LiquidGL target in enabled and disabled states", () => {
    const { getByTestId, rerender, props } = renderRail({});
    const mic = getByTestId("toggle-mic");

    expect(mic.classList.contains("liquidGL")).toBe(true);
    expect(mic.getAttribute("data-control")).toBe("mic");
    expect(mic.getAttribute("data-active")).toBe("true");
    expect(mic.querySelector(".control-btn__solid")).not.toBeNull();
    expect(mic.querySelector("[data-symbol='microphone-on']")).not.toBeNull();

    rerender(<CallControlRail {...props} audioEnabled={false} />);
    expect(mic.classList.contains("liquidGL")).toBe(true);
    expect(mic.getAttribute("data-active")).toBe("false");
    expect(mic.querySelector("[data-symbol='microphone-off']")).not.toBeNull();
  });

  it("more button always uses LiquidGL and has no solid surface", () => {
    const { getByTestId } = renderRail({});
    const more = getByTestId("more-button");
    expect(more.classList.contains("liquidGL")).toBe(true);
    expect(more.getAttribute("data-control")).toBe("more");
    expect(more.querySelector(".control-btn__solid")).toBeNull();
    expect(more.querySelector("[data-symbol='more']")).not.toBeNull();
  });

  it("end call button never uses LiquidGL", () => {
    const { getByTestId } = renderRail({});
    const end = getByTestId("end-call");
    expect(end.classList.contains("liquidGL")).toBe(false);
    expect(end.getAttribute("data-control")).toBe("end");
    expect(end.querySelector(".control-btn__solid")).toBeNull();
    expect(end.querySelector("[data-symbol='end-call']")).not.toBeNull();
  });

  it("end call button keeps a solid red surface with a white symbol", () => {
    const rule = callCss.match(
      /\.control-btn\[data-control="end"\]\s*\{[^}]*\}/,
    );
    expect(rule).not.toBeNull();
    expect(rule?.[0]).toContain("background: var(--color-end-call)");
    expect(rule?.[0]).toContain("color: var(--color-white)");
  });

  it("aria-pressed reflects the disabled media state", () => {
    const { getByTestId } = renderRail({
      videoEnabled: false,
      audioEnabled: false,
    });
    expect(getByTestId("toggle-camera").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(getByTestId("toggle-mic").getAttribute("aria-pressed")).toBe("true");
  });

  it("aria-pressed is unset while media is enabled", () => {
    const { getByTestId } = renderRail({});
    expect(getByTestId("toggle-camera").getAttribute("aria-pressed")).toBeNull();
    expect(getByTestId("toggle-mic").getAttribute("aria-pressed")).toBeNull();
  });

  it("invokes each toggle exactly once per click", async () => {
    const user = userEvent.setup();
    const { getByTestId, props } = renderRail({});

    await user.click(getByTestId("toggle-camera"));
    expect(props.onToggleCamera).toHaveBeenCalledTimes(1);

    await user.click(getByTestId("toggle-mic"));
    expect(props.onToggleMic).toHaveBeenCalledTimes(1);

    await user.click(getByTestId("end-call"));
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  it("does not create duplicate buttons across repeated state changes", () => {
    const { container, rerender, props } = renderRail({});
    for (let i = 0; i < 6; i += 1) {
      rerender(
        <CallControlRail
          {...props}
          videoEnabled={i % 2 === 0}
          audioEnabled={i % 2 === 1}
        />,
      );
    }
    expect(container.querySelectorAll("button").length).toBe(4);
    expect(container.querySelectorAll(".liquidGL").length).toBe(3);
  });
});

describe("ContactPill", () => {
  it("is itself the LiquidGL target with content inside", () => {
    const { getByTestId } = render(
      <ContactPill name="Pho" avatar="" connecting={false} />,
    );
    const pill = getByTestId("contact-pill");
    expect(pill.classList.contains("liquidGL")).toBe(true);
    expect(pill.querySelector(".contact-pill__lens")).toBeNull();
    expect(pill.querySelector(".content")).not.toBeNull();
    expect(pill.textContent).toContain("Pho");
  });

  it("hides the initials fallback behind the hidden attribute when an avatar loads", () => {
    const { container } = render(
      <ContactPill name="Pho" avatar="/avatars/pho.jpg" connecting={false} />,
    );
    const fallback = container.querySelector(".contact-pill__avatar-fallback");
    expect(fallback).not.toBeNull();
    expect(fallback?.hasAttribute("hidden")).toBe(true);
    expect(fallback?.textContent).toBe("P");
    expect(globalCss).toContain("[hidden]");
    expect(globalCss).toContain("display: none !important");
  });

  it("shows one initial for single-word names", () => {
    const { container } = render(
      <ContactPill name="Pho" avatar="" connecting={false} />,
    );
    const fallback = container.querySelector(".contact-pill__avatar-fallback");
    expect(fallback?.hasAttribute("hidden")).toBe(false);
    expect(fallback?.textContent).toBe("P");
  });
});

describe("EffectsButton", () => {
  it("is itself the LiquidGL target", () => {
    const { getByTestId } = render(<EffectsButton />);
    const effects = getByTestId("aperture-button");
    expect(effects.classList.contains("liquidGL")).toBe(true);
    expect(effects.querySelector(".effects-btn__lens")).toBeNull();
    expect(effects.querySelector(".content")).not.toBeNull();
  });
});
