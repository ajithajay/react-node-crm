import { z } from 'zod';

/** `GET /search?q=` — cross-object quick-jump search (command menu). */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;
