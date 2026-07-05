export const API = "http://127.0.0.1:8000";

export const sendMessage = async (message: string) => {
  const res = await fetch(`${API}/coach/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  return res.json();
};