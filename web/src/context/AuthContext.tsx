import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AdminUser, AuthSession } from "../types";
import { api, getStoredToken, setStoredToken, getStoredUser, setStoredUser } from "../services/api";

type Result = { success: boolean; message?: string };

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<Result>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<Result>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AdminUser | null>(() => getStoredUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const startSession = useCallback((session: AuthSession) => {
    setStoredToken(session.token);
    setStoredUser(session.user);
    setToken(session.token);
    setUser(session.user);
    setIsAuthenticated(true);
  }, []);

  const endSession = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  // Validate the stored session on startup; a 401 ends it through the unauthorized event
  useEffect(() => {
    if (!getStoredToken()) {
      endSession();
      setLoading(false);
      return;
    }
    api<AdminUser>("GET", "/api/auth/me")
      .then((profile) => {
        setUser(profile);
        setStoredUser(profile);
        setIsAuthenticated(true);
      })
      .catch((err) => console.error("[Auth] Session validation failed:", err))
      .finally(() => setLoading(false));
  }, [endSession]);

  useEffect(() => {
    window.addEventListener("nodemaster:unauthorized", endSession);
    return () => window.removeEventListener("nodemaster:unauthorized", endSession);
  }, [endSession]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      startSession(await api<AuthSession>("POST", "/api/auth/login", { username, password }));
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || "登录失败，请检查账号密码" };
    }
  }, [startSession]);

  const logout = useCallback(async () => {
    try {
      if (getStoredToken()) await api("POST", "/api/auth/logout").catch(() => {});
    } finally {
      endSession();
    }
  }, [endSession]);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    try {
      // The server revokes all sessions and returns a fresh token for this one
      startSession(await api<AuthSession>("POST", "/api/auth/change-password", { oldPassword, newPassword }));
      return { success: true, message: "密码修改成功" };
    } catch (err: any) {
      return { success: false, message: err.message || "密码修改失败" };
    }
  }, [startSession]);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, loading, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
