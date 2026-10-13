export type * from "../../../shared/types.js";
export interface AdminUser {
  sessionVersion: string;
  username: string;
  passwordHash: string;
  salt: string;
  updatedAt: number;
}

