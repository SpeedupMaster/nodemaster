export type * from "../../../shared/types.js";
import type { PublicNodeItem as StoredNode, AdminProfile } from "../../../shared/types.js";
export interface NodeItem extends Omit<StoredNode, "costAmount" | "expiresAt"> {
  costAmount?: number | null;
  expiresAt?: string | null;
}
export type AdminUser = AdminProfile;
export interface AuthSession { token: string; user: AdminUser }
