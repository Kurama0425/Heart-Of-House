export async function request(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({ error: "Unexpected API response. Check the API URL and server." }));
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}
