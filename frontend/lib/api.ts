import { getOrCreateUserId } from "./user";

export const API = "http://127.0.0.1:8000";

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RecentActivityPayload {
  workouts: string;
  calories: string;
  steps: string;
}

export async function sendMessage(
  message: string,
  profile: any,
  mode: string,
  history: HistoryMessage[],
  activity: RecentActivityPayload
) {
  const userId = getOrCreateUserId();
  const res = await fetch(`${API}/coach/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_profile: {
        age: Number(profile.age) || 24,
        weight: Number(profile.weight) || 75,
        goal: profile.goal || "fat loss"
      },
      recent_activity: activity,
      conversation_history: history,
      current_message: message,
      mode,
      user_id: userId
    }),
  });

  return res.json();
}