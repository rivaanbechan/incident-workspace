export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const payload = await response.json()

  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}.`,
    )
  }

  return payload as T
}
