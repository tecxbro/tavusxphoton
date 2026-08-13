import { describe, expect, it } from "vitest";
import {
  effectiveSafeInsets,
  isReferencePhoneViewport,
  shouldApplyIphoneTopFallback,
} from "../../hooks/useSafeViewport";

const REFERENCE_PHONE = { width: 400, height: 874 };
const DESKTOP = { width: 1280, height: 800 };
const LANDSCAPE_PHONE = { width: 874, height: 400 };
const SHORT_PORTRAIT = { width: 390, height: 700 };
const TALL_NARROW = { width: 360, height: 850 };

describe("useSafeViewport safe insets", () => {
  it("detects the reference phone viewport band", () => {
    expect(isReferencePhoneViewport(REFERENCE_PHONE)).toBe(true);
    expect(isReferencePhoneViewport({ width: 375, height: 800 })).toBe(true);
    expect(isReferencePhoneViewport({ width: 440, height: 960 })).toBe(true);
    expect(isReferencePhoneViewport(DESKTOP)).toBe(false);
    expect(isReferencePhoneViewport(LANDSCAPE_PHONE)).toBe(false);
    expect(isReferencePhoneViewport(SHORT_PORTRAIT)).toBe(false);
    expect(isReferencePhoneViewport(TALL_NARROW)).toBe(false);
  });

  it("prefers native top inset when the host reports one", () => {
    expect(
      effectiveSafeInsets(
        { top: 59, right: 0, bottom: 34, left: 0 },
        REFERENCE_PHONE,
      ),
    ).toEqual({ top: 59, right: 0, bottom: 34, left: 0 });
  });

  it("applies the 47px top fallback when native top is 0 on a reference phone viewport", () => {
    expect(shouldApplyIphoneTopFallback(0, REFERENCE_PHONE)).toBe(true);
    expect(
      effectiveSafeInsets(
        { top: 0, right: 0, bottom: 0, left: 0 },
        REFERENCE_PHONE,
      ),
    ).toEqual({ top: 47, right: 0, bottom: 0, left: 0 });
  });

  it("does not apply the fallback on landscape, desktop, or out-of-band portrait", () => {
    expect(shouldApplyIphoneTopFallback(0, LANDSCAPE_PHONE)).toBe(false);
    expect(shouldApplyIphoneTopFallback(0, DESKTOP)).toBe(false);
    expect(shouldApplyIphoneTopFallback(0, SHORT_PORTRAIT)).toBe(false);
    expect(shouldApplyIphoneTopFallback(0, TALL_NARROW)).toBe(false);
    expect(shouldApplyIphoneTopFallback(59, REFERENCE_PHONE)).toBe(false);
  });

  it("returns native insets unchanged when fallback does not apply", () => {
    const native = { top: 0, right: 0, bottom: 21, left: 0 };
    expect(effectiveSafeInsets(native, DESKTOP)).toEqual(native);
  });
});
