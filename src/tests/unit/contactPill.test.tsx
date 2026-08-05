import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContactPill } from "../../components/ContactPill";

describe("ContactPill", () => {
  it("invokes onMetricsInvalidate immediately when the label changes", () => {
    const onMetricsInvalidate = vi.fn();
    const { rerender } = render(
      <ContactPill
        name="Gary"
        avatar="/avatars/pho.jpg"
        connecting={false}
        onMetricsInvalidate={onMetricsInvalidate}
      />,
    );

    expect(onMetricsInvalidate).toHaveBeenCalledTimes(1);

    rerender(
      <ContactPill
        name="Gary"
        avatar="/avatars/pho.jpg"
        connecting
        onMetricsInvalidate={onMetricsInvalidate}
      />,
    );

    expect(onMetricsInvalidate).toHaveBeenCalledTimes(2);
  });
});
