export function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "1"; // Fallback during SSR builds
  
  let userId = localStorage.getItem("fit_user");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("fit_user", userId);
  }
  return userId;
}
