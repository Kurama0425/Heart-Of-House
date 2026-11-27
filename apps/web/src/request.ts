export async function request(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Unexpected API response. Check the API URL and server."); }
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Request failed");
  return data;
}
