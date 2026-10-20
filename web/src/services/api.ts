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

// Wraps a fetch implementation so same-origin /api/ calls carry the session token and a real 401 logs out
function withAuth(fetchImpl: typeof window.fetch): typeof window.fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = getStoredToken();
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : {}));

    const targetUrl = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    const sameApi = targetUrl.origin === window.location.origin && targetUrl.pathname.startsWith("/api/");
    if (sameApi && token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetchImpl(input, {
      ...init,
      headers,
    });

    if (sameApi && response.status === 401 && getStoredToken() === token) {
      if (targetUrl.pathname !== "/api/auth/login") {
        setStoredToken(null);
        setStoredUser(null);
        window.dispatchEvent(new CustomEvent("nodemaster:unauthorized"));
      }
    }

    return response;
  };
}

// Initialize global interceptor so existing fetch() calls throughout the app attach the auth header seamlessly
export function initAuthInterceptor() {
  if (typeof window === "undefined") return;
  if ((window.fetch as any).__nodemasterAuth) return;
  window.fetch = withAuth(window.fetch.bind(window));
  (window.fetch as any).__nodemasterAuth = true;
}
