export async function sendFeedback(message: string, email?: string): Promise<void> {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, email: email || undefined }),
  });
  if (!res.ok) throw new Error(`feedback submission failed: ${res.status}`);
}
