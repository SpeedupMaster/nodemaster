import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AdminUser } from "../types";
import {
  getStoredToken,
  setStoredToken,
  getStoredUser,
  setStoredUser,
} from "../services/api";

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AdminUser | null>(() => getStoredUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!getStoredToken());
  const [loading, setLoading] = useState<boolean>(true);

  // Validate session on startup
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = getStoredToken();
      if (!storedToken) {
        setIsAuthenticated(false);
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });
        const data = await res.json();
        if (data.success && data.data) {
          setUser(data.data);
          setStoredUser(data.data);
          setIsAuthenticated(true);
        } else {
          setStoredToken(null);
          setStoredUser(null);
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("[Auth] Session validation failed:", err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Listen to 401 unauthorized events from any api request
  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    };

    window.addEventListener("nodemaster:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("nodemaster:unauthorized", handleUnauthorized);
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || "登录失败，请检查账号密码",
        };
      }

      const receivedToken = data.data.token;
      const receivedUser = data.data.user;

      setStoredToken(receivedToken);
      setStoredUser(receivedUser);
      setToken(receivedToken);
      setUser(receivedUser);
      setIsAuthenticated(true);

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "网络请求异常，请检查服务器连接",
      };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const currentToken = getStoredToken();
      if (currentToken) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }).catch(() => {});
      }
    } finally {
      setStoredToken(null);
      setStoredUser(null);
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    try {
      const currentToken = getStoredToken();
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || "密码修改失败",
        };
      }

      // If server returned a refreshed token
      if (data.data?.token) {
        setStoredToken(data.data.token);
        setToken(data.data.token);
      }
      if (data.data?.user) {
        setStoredUser(data.data.user);
        setUser(data.data.user);
      }

      return {
        success: true,
        message: data.message || "密码修改成功",
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "网络请求失败，请稍后重试",
      };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        loading,
        login,
        logout,
        changePassword,
      }}
    >
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
