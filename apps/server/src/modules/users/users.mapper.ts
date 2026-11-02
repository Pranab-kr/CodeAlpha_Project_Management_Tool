import type { UserDTO } from "@teamboard/shared";
import type { SelectUser } from "../../db/schema/index.js";

function initialsFor(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  if (words.length === 1 && words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function toUserDTO(user: SelectUser): UserDTO {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    initials: initialsFor(user.name, user.email),
    createdAt: user.createdAt.toISOString(),
  };
}
