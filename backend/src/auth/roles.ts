import type { Role } from '../db/schema';

/** Ordered privilege rank: higher number = more privilege. */
const RANK: Record<Role, number> = {
  viewer: 0,
  analyst: 1,
  org_admin: 2,
  prv_super_admin: 3,
};

export function rankOf(role: Role): number {
  return RANK[role];
}

/** requiredRole is a MINIMUM: equal or higher rank passes. */
export function meetsRequirement(userRole: Role, requiredRole: Role): boolean {
  return RANK[userRole] >= RANK[requiredRole];
}

/**
 * An actor may assign a role only at or below its own rank. Because
 * prv_super_admin is the top rank, this already means only a prv_super_admin
 * can assign prv_super_admin.
 */
export function canAssign(actorRole: Role, targetRole: Role): boolean {
  return RANK[targetRole] <= RANK[actorRole];
}

/** An actor may act on a target user only if the target's CURRENT rank is <= the actor's. */
export function canActOn(actorRole: Role, targetRole: Role): boolean {
  return RANK[targetRole] <= RANK[actorRole];
}
