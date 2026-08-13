import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { IncomingCallCard } from "../../components/IncomingCallCard";

function renderCard() {
  return render(
    <MemoryRouter>
      <IncomingCallCard />
    </MemoryRouter>,
  );
}

describe("IncomingCallCard", () => {
  it("shows the FaceTime decision surface without requesting media", () => {
    const getUserMedia = vi.spyOn(navigator.mediaDevices, "getUserMedia");
    renderCard();

    expect(screen.getByTestId("incoming-call-card")).toHaveAttribute(
      "data-state",
      "incoming",
    );
    expect(screen.getByText("Garry Tan")).toBeInTheDocument();
    expect(screen.getByText("FaceTime Video…")).toBeInTheDocument();
    expect(screen.getByTestId("incoming-accept")).toHaveAttribute(
      "href",
      "/call/demo",
    );
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("stays in the card and shows Call Declined after Decline", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByTestId("incoming-decline"));

    expect(screen.getByTestId("incoming-call-card")).toHaveAttribute(
      "data-state",
      "declined",
    );
    expect(screen.getByText("Call Declined")).toBeInTheDocument();
    expect(screen.queryByTestId("incoming-accept")).not.toBeInTheDocument();
    expect(screen.queryByTestId("incoming-decline")).not.toBeInTheDocument();
    expect(screen.queryByText("FaceTime Video…")).not.toBeInTheDocument();
  });
});
