import { DecodedUser } from './types';

/**
 * What a person may do inside their own organisation (Roadmap #35g).
 *
 * The backend enforces every one of these and is the authority. These helpers
 * exist so the portal does not offer a control that will be refused, and so the
 * reason can be shown in a tooltip rather than surfacing as a bare 403.
 *
 * An ABSENT org_role is unrestricted, never "user". It is absent on
 * platform-admin tokens and on any token minted before this shipped, and
 * defaulting those to the least privileged role would lock owners out of their
 * own settings for the life of their session.
 */
export const isOrgOwner = (u?: DecodedUser | null) => !u?.org_role || u.org_role === 'owner';

/** Owner or admin: senior enough to see what the goods cost the business. */
export const canSeeCost = (u?: DecodedUser | null) => !u?.org_role || u.org_role !== 'user';

export const ORG_ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  user: 'Staff',
};

/** Why a control is disabled, for the tooltip. Empty string when it is not. */
export const orgRoleReason = (u: DecodedUser | null | undefined, need: 'owner' | 'cost') =>
  need === 'owner'
    ? (isOrgOwner(u) ? '' : 'Only the account owner can change this.')
    : (canSeeCost(u) ? '' : 'Cost and margin figures are visible to owners and admins.');
