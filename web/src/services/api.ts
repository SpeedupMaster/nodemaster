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

/** Ends the local session; AuthContext listens for the event and returns to the login page. */
export function signalUnauthorized() {
  setStoredToken(null);
  window.dispatchEvent(new CustomEvent("nodemaster:unauthorized"));
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * fetch() for the panel's own API: adds the session token and treats a 401 on an authenticated call
 * as the end of the session. Only relative /api/ paths are accepted, so the token never leaves the origin.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!path.startsWith("/api/")) throw new Error(`apiFetch only accepts /api/ paths, got ${path}`);
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers });
  // A failed login is a 401 too, but there is no session to end; a token swapped meanwhile is newer
  if (response.status === 401 && token && getStoredToken() === token) signalUnauthorized();
  return response;
}

/** JSON API call: resolves with `data` of a `{ success: true }` response, otherwise throws ApiError. */
export async function api<T = unknown>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await apiFetch(path, {
    method,
    signal,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  let payload: { success?: boolean; data?: T; message?: string } | null = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON (proxy error page, empty body) is reported below with the HTTP status
  }
  if (!response.ok || !payload?.success) {
    throw new ApiError(payload?.message || `请求失败 (HTTP ${response.status})`, response.status);
  }
  return payload.data as T;
}
