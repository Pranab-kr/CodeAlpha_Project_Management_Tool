import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DatePicker from "./date-picker";

function todayValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

describe("DatePicker", () => {
  it("shows the current value and picks a day in the visible month", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value="2026-11-15" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Nov 15, 2026" }));
    expect(screen.getByText("November 2026")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Sunday, November 8, 2026" }),
    );
    expect(onChange).toHaveBeenCalledWith("2026-11-08");
  });

  it("falls back to today's month when there is no value", async () => {
    const user = userEvent.setup();
    render(<DatePicker value={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Pick a date" }));
    const today = new Date();
    const monthLabel = new Intl.DateTimeFormat("en", {
      month: "long",
      year: "numeric",
    }).format(today);
    expect(screen.getByText(monthLabel)).toBeInTheDocument();
  });

  it("clears the value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value="2026-11-15" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Nov 15, 2026" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("selects today as a local calendar date", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value={null} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Pick a date" }));
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(onChange).toHaveBeenCalledWith(todayValue());
  });

  it("navigates to the next month", async () => {
    const user = userEvent.setup();
    render(<DatePicker value="2026-11-15" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Nov 15, 2026" }));
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("December 2026")).toBeInTheDocument();
  });
});
