/** Link that opens the table and joins (after Google or guest). */
export function roomUrl(code: string): string {
  return `${location.origin}/sala/${encodeURIComponent(code)}`;
}

/** Native share sheet, or copy the join link. */
export async function shareRoom(code: string): Promise<"shared" | "copied" | "cancelled"> {
  const url = roomUrl(code);
  const payload = { title: "Poker Friends", text: `Entra na mesa ${code}`, url };
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    window.prompt("Copia o link da mesa", url);
  }
  return "copied";
}
