import { Router } from "express";
import crypto from "crypto";
import { db } from "../db/index.js";
import { signAdminToken } from "../services/authService.js";
import { hashPassword, verifyPassword } from "../services/security.js";
import { HttpError, InputError, optString } from "../services/validation.js";
import { wsHub } from "../services/wsHub.js";
import { LEGACY_DEFAULT_PASSWORD, MINUTE, PASSWORD_MIN_LENGTH } from "../constants.js";
import { ok } from "./util.js";

const MAX_LOGIN_ATTEMPTS = 10;
const loginAttempts = new Map<string, { count: number; until: number }>();

const profile = () => ({ username: db.getAdmin().username, updatedAt: db.getAdmin().updatedAt });

export const authPublicRouter = Router();

authPublicRouter.post("/auth/login", (req, res) => {
  const key = req.ip || "unknown";
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) if (entry.until <= now) loginAttempts.delete(ip);
  const entry = loginAttempts.get(key) || { count: 0, until: now + MINUTE };
  if (entry.count >= MAX_LOGIN_ATTEMPTS) throw new HttpError(429, "登录尝试过多，请一分钟后重试");
  entry.count++;
  loginAttempts.set(key, entry);

  const username = optString(req.body, "username");
  const password = optString(req.body, "password");
  if (!username || !password) throw new InputError("请输入用户名和密码");
  const admin = db.getAdmin();
  if (username !== admin.username || !verifyPassword(password, admin.passwordHash, admin.salt)) {
    throw new HttpError(401, "用户名或密码错误");
  }
  ok(res, { token: signAdminToken(), user: profile() });
});

export const authRouter = Router();

authRouter.get("/auth/me", (_req, res) => ok(res, profile()));

authRouter.post("/auth/change-password", (req, res) => {
  const oldPassword = optString(req.body, "oldPassword");
  const newPassword = optString(req.body, "newPassword");
  if (!oldPassword || !newPassword) throw new InputError("原密码与新密码均不能为空");
  if (newPassword.length < PASSWORD_MIN_LENGTH || newPassword === LEGACY_DEFAULT_PASSWORD) {
    throw new InputError(`新密码至少 ${PASSWORD_MIN_LENGTH} 位，不能使用旧默认密码`);
  }
  const admin = db.getAdmin();
  if (!verifyPassword(oldPassword, admin.passwordHash, admin.salt)) throw new InputError("当前原密码输入错误");

  const { hash, salt } = hashPassword(newPassword);
  db.updateAdmin({ passwordHash: hash, salt, sessionVersion: crypto.randomUUID() });
  wsHub.closeRevokedClients();
  ok(res, { token: signAdminToken(), user: profile() }, "密码修改成功");
});

authRouter.post("/auth/logout", (_req, res) => {
  db.revokeSessions();
  wsHub.closeRevokedClients();
  ok(res, undefined, "已安全退出登录");
});
