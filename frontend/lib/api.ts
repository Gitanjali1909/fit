import { getOrCreateUserId } from "./user";

export const API = "http://127.0.0.1:8000";

export async function sendMessage(message: string, profile: any, mode: string) {
  const userId = getOrCreateUserId();
  const res = await fetch(`${API}/coach/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      profile,
      mode,
      user_id: userId
    }),
  });

  return res.json();
}