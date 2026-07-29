import { getOrCreateUserId } from "./user";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://fit-65of.onrender.com";

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
  const res = await fetch(`${BASE_URL}/coach/chat`, {
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

export async function analyzeFood(food: string, userId: string) {
  const res = await fetch(`${BASE_URL}/food/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ food, user_id: userId }),
  });
  return res.json();
}

export async function getDashboard(userId: string) {
  const res = await fetch(`${BASE_URL}/dashboard/${userId}`);
  return res.json();
}

export const API = {
  sendMessage,
  analyzeFood,
  getDashboard,
};