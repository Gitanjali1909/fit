export const API = "http://127.0.0.1:8000";

export async function sendMessage(message: string, profile: any, mode: string) {
  const res = await fetch("http://127.0.0.1:8000/coach/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      profile,
      mode
    }),
  });

  return res.json();
}