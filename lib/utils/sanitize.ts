/**
 * Escapes special characters in SQL LIKE patterns.
 * Prevents user input containing %, _, or \ from acting as wildcards.
 */
export function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&")
}

/**
 * Wraps an escaped input in % wildcards for partial matching.
 * Safe for use in Supabase .ilike() and .or() calls.
 */
export function likePattern(input: string): string {
  return `%${escapeLike(input)}%`
}
