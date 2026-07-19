import type { Request } from 'express';

/** Who is acting on a request — a logged-in user (member) or an API key (role, no member). */
export type Principal =
  | { type: 'user'; userId: string }
  | { type: 'apiKey'; apiKeyId: string; roleId: string | null; name: string };

/** Resolves the acting principal from whichever auth path the guard on this route allowed. */
export function principalOf(req: Pick<Request, 'user' | 'apiKey'>): Principal {
  if (req.apiKey) {
    return { type: 'apiKey', apiKeyId: req.apiKey.id, roleId: req.apiKey.roleId, name: req.apiKey.name };
  }
  return { type: 'user', userId: req.user!.id };
}

/** The user id to stamp on audit logs / ownership columns — `null` for an API-key-driven action. */
export function actorUserId(principal: Principal): string | null {
  return principal.type === 'user' ? principal.userId : null;
}
