export const GUEST_COOKIE = "poker_guest";
export const GUEST_ID_RE = /^guest_[a-zA-Z0-9_-]{10,64}$/;

export function isValidGuestId(id: string | undefined | null): id is string {
  return !!id && GUEST_ID_RE.test(id);
}

export function newGuestId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `guest_${rand.slice(0, 32)}`;
}
