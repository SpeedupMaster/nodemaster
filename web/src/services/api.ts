import { AdminUser } from "../types";

export const AUTH_TOKEN_KEY = "nodemaster_auth_token";
export const AUTH_USER_KEY = "nodemaster_auth_user";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch (err) {
    console.error("[Auth] Failed to set token in localStorage:", err);
  }
}

export function getStoredUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AdminUser | null) {
  try {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch (err) {
    console.error("[Auth] Failed to set user in localStorage:", err);
  }
}

// Global fetch wrapper that automatically attaches the Authorization header
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : {}));

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await window.fetch(input, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    const urlStr = typeof input === "string" ? input : input instanceof Request ? input.url : "";
    if (!urlStr.includes("/api/auth/login")) {
      setStoredToken(null);
      setStoredUser(null);
      window.dispatchEvent(new CustomEvent("nodemaster:unauthorized"));
    }
  }

  return response;
}

// Initialize global interceptor so existing fetch() calls throughout the app attach the auth header seamlessly
export function initAuthInterceptor() {
  if (typeof window === "undefined") return;
  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = getStoredToken();
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : {}));

    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await originalFetch(input, {
      ...init,
      headers,
    });

    if (response.status === 401) {
      const urlStr = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      if (!urlStr.includes("/api/auth/login")) {
        setStoredToken(null);
        setStoredUser(null);
        window.dispatchEvent(new CustomEvent("nodemaster:unauthorized"));
      }
    }

    return response;
  };
}
