import { describe, expect, it } from "vitest";
import {
  effectiveSafeInsets,
  shouldApplyIphoneTopFallback,
} from "../../hooks/useSafeViewport";

describe("useSafeViewport safe insets", () => {
  it("prefers native top inset when the host reports one", () => {
    expect(
      effectiveSafeInsets({ top: 59, right: 0, bottom: 34, left: 0 }),
    ).toEqual({ top: 59, right: 0, bottom: 34, left: 0 });
  });

  it("applies the 47px top fallback only for portrait iPhone coarse hosts", () => {
    expect(
      shouldApplyIphoneTopFallback(0, {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        coarsePointer: true,
        landscape: false,
      }),
    ).toBe(true);
  });

  it("does not apply the fallback on desktop, landscape, or non-iPhone", () => {
    expect(
      shouldApplyIphoneTopFallback(0, {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        coarsePointer: true,
        landscape: true,
      }),
    ).toBe(false);

    expect(
      shouldApplyIphoneTopFallback(0, {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)",
        coarsePointer: false,
        landscape: false,
      }),
    ).toBe(false);

    expect(
      shouldApplyIphoneTopFallback(0, {
        userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)",
        coarsePointer: true,
        landscape: false,
      }),
    ).toBe(false);

    expect(
      shouldApplyIphoneTopFallback(59, {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        coarsePointer: true,
        landscape: false,
      }),
    ).toBe(false);
  });

  it("returns native insets unchanged when fallback does not apply", () => {
    const native = { top: 0, right: 0, bottom: 21, left: 0 };
    const result = effectiveSafeInsets(native);
    if (
      !shouldApplyIphoneTopFallback(0, {
        userAgent: navigator.userAgent,
        coarsePointer: window.matchMedia("(pointer: coarse)").matches,
        landscape: window.matchMedia("(orientation: landscape)").matches,
      })
    ) {
      expect(result).toEqual(native);
    }
  });
});
