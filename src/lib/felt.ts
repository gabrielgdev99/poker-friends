import type { FeltAccent } from "@/lib/types";

export function feltCss(accent: FeltAccent): {
  felt: string;
  feltLit: string;
  rim: string;
} {
  switch (accent) {
    case "wine":
      return { felt: "#4a1a28", feltLit: "#6b2a3a", rim: "#3a2018" };
    case "navy":
      return { felt: "#1a2a45", feltLit: "#2a456b", rim: "#1a2838" };
    case "amber":
      return { felt: "#3a2a12", feltLit: "#5c4218", rim: "#4a3218" };
    default:
      return { felt: "#1a4530", feltLit: "#2a6b3e", rim: "#4a3218" };
  }
}
