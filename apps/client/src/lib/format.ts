const INITIAL_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-indigo-100 text-indigo-700",
  "bg-fuchsia-100 text-fuchsia-700",
] as const;

/** Stable color class for an avatar, keyed by a user or project id. */
export function initialsColor(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return INITIAL_COLORS[hash % INITIAL_COLORS.length];
}

/** Compact project label: two initials for multi-word names, else two chars. */
export function projectInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
];

export function formatRelativeTime(
  isoDate: string,
  now: Date = new Date(),
): string {
  const seconds = Math.round(
    (new Date(isoDate).getTime() - now.getTime()) / 1000,
  );
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size || unit === "second") {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
  return formatter.format(0, "second");
}

/**
 * Parse a date-only `YYYY-MM-DD` string as a local calendar date.
 * `new Date("YYYY-MM-DD")` would parse it as UTC midnight and can shift the day.
 */
export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(parseLocalDate(value));
}

/** Compares local calendar days, so a due date is overdue the day after it. */
export function isOverdue(
  value: string | null,
  today: Date = new Date(),
): boolean {
  if (!value) return false;
  const due = parseLocalDate(value);
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return due.getTime() < startOfToday.getTime();
}
