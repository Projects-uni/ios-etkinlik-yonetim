export async function parseJsonBody<T>(req: Request): Promise<T | null> {
  const text = await req.text();
  if (text.trim().length === 0) {
    return null;
  }
  return JSON.parse(text) as T;
}
