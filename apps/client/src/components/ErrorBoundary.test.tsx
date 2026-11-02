import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

function Broken(): never {
  throw new Error("Test crash");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("renders a friendly reload card when a child crashes", () => {
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("renders its children while healthy", async () => {
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <button type="button" onClick={() => undefined}>
          Healthy
        </button>
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole("button", { name: "Healthy" }));
    expect(
      screen.queryByRole("heading", { name: "Something went wrong" }),
    ).not.toBeInTheDocument();
  });
});
