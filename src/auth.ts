import { empireStore } from "./store/empire"
import type { Empire } from "./types"

export const resolveToken = (authorization: string | undefined): Empire | null => {
  if (!authorization?.startsWith("Bearer ")) return null
  const token = authorization.slice(7)
  return empireStore.getByToken(token) ?? null
}
