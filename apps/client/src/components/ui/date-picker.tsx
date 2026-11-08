import { cn } from "cn";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { parseLocalDate } from "../../lib/format";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;

const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});
const dayLabelFormatter = new Intl.DateTimeFormat("en", { dateStyle: "full" });
const valueFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

/** Format a local calendar date as the API's `YYYY-MM-DD` value. */
function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Six weeks of local calendar days, starting on Monday, so the grid is stable. */
function buildMonthDays(viewDate: Date): Date[] {
  const firstOfMonth = startOfMonth(viewDate);
  const leadingDays = (firstOfMonth.getDay() + 6) % 7;
  const firstCell = new Date(firstOfMonth);
  firstCell.setDate(firstOfMonth.getDate() - leadingDays);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstCell);
    day.setDate(firstCell.getDate() + index);
    return day;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Date-only picker built on the project's Popover primitive.
 *
 * The popover positions itself with collision avoidance, so the calendar stays
 * inside the viewport instead of being clipped at the window edge the way the
 * native `<input type="date">` calendar can be inside a right-side sheet.
 */
export default function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  invalid = false,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseLocalDate(value) : null;
  const [viewDate, setViewDate] = useState(() =>
    startOfMonth(selected ?? new Date()),
  );

  const days = useMemo(() => buildMonthDays(viewDate), [viewDate]);
  const today = new Date();

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setViewDate(startOfMonth(selected ?? new Date()));
    }
    setOpen(nextOpen);
  };

  const choose = (date: Date | null) => {
    onChange(date ? toDateValue(date) : null);
    setOpen(false);
  };

  const changeMonth = (offset: number) => {
    setViewDate(
      new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1),
    );
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            id={id}
            aria-invalid={invalid || undefined}
            className="w-full justify-start gap-2 font-normal"
          />
        }
      >
        <CalendarDaysIcon
          aria-hidden="true"
          className="text-muted-foreground"
        />
        <span className={cn(!value && "text-muted-foreground")}>
          {value ? valueFormatter.format(parseLocalDate(value)) : placeholder}
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-72 max-w-[calc(100vw-2rem)] p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span aria-live="polite" className="text-sm font-medium">
            {monthFormatter.format(viewDate)}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Next month"
              onClick={() => changeMonth(1)}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div aria-hidden="true" className="mt-2 grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((weekday, index) => (
            <span
              key={`${weekday}-${index}`}
              className="flex h-7 items-center justify-center text-xs font-medium text-muted-foreground"
            >
              {weekday}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {days.map((day) => {
            const inMonth = day.getMonth() === viewDate.getMonth();
            const isSelected = selected ? isSameDay(day, selected) : false;
            const isToday = isSameDay(day, today);
            return (
              <button
                type="button"
                key={toDateValue(day)}
                aria-label={dayLabelFormatter.format(day)}
                aria-pressed={isSelected}
                onClick={() => choose(day)}
                className={cn(
                  "flex aspect-square w-full items-center justify-center rounded-md text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-popover",
                  !inMonth && "text-muted-foreground/60",
                  isToday && !isSelected && "font-semibold ring-1 ring-ring/60",
                  isSelected &&
                    "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between border-t pt-2">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => choose(null)}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => choose(new Date())}
          >
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
