import React, { useState, useRef, useEffect, useCallback } from "react";
import { Eye, EyeSlash, WarningCircle, Warning, CircleNotch, XCircle, Check, Copy, CaretRight } from "@phosphor-icons/react";
import gsap from "gsap";
import { useAuth } from "../../context/AuthContext";
import { Logo } from "../common/Logo";
import { ThemeToggle } from "../layout/ThemeToggle";

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      const tl = gsap.timeline();
      tl.from(cardRef.current.querySelectorAll("[data-login-stagger], form > *"), {
        opacity: 0,
        y: 8,
        duration: 0.45,
        stagger: 0.05,
        ease: "expo.out",
        clearProps: "transform,opacity",
      });
      return () => {
        tl.revert();
      };
    }
  }, []);

  const triggerErrorShake = (msg: string) => {
    setErrorMsg(msg);
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { x: -8 },
        { x: 8, duration: 0.07, repeat: 5, yoyo: true, ease: "sine.inOut", clearProps: "x" }
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState("CapsLock"));
  };

  const handleUsernameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      passwordInputRef.current?.focus();
    }
  };

  const handleClearUsername = () => {
    setUsername("");
    setUsernameError(null);
    usernameInputRef.current?.focus();
  };

  const handleCopyText = useCallback((text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    let hasError = false;

    if (!username.trim()) {
      setUsernameError("请输入管理员账号");
      usernameInputRef.current?.focus();
      hasError = true;
    } else {
      setUsernameError(null);
    }

    if (!password) {
      setPasswordError("请输入管理密码");
      if (!hasError) passwordInputRef.current?.focus();
      hasError = true;
    } else {
      setPasswordError(null);
    }

    if (hasError) {
      triggerErrorShake("请完整填写管理员身份凭据");
      return;
    }

    setLoading(true);

    const result = await login(username.trim(), password);
    setLoading(false);

    if (result.success) {
      onLoginSuccess?.();
    } else {
      triggerErrorShake(result.message || "账号或密码错误，请核对后重试");
    }
  };

  const field = (hasError: boolean) =>
    `w-full h-11 bg-paper border rounded-lg text-base sm:text-sm text-ink placeholder:text-ink-muted focus:outline-none transition-colors ${
      hasError
        ? "border-status-danger focus:ring-2 focus:ring-status-danger/25"
        : "border-rule-active hover:border-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/25"
    }`;

  const CopyBtn: React.FC<{ text: string; idx: number; label: string }> = ({ text, idx, label }) => (
    <button
      type="button"
      onClick={() => handleCopyText(text, idx)}
      aria-label={label}
      className="shrink-0 h-7 px-2 rounded-md border border-rule bg-paper-3 text-ink-secondary hover:text-ink text-[11px] font-sans flex items-center gap-1 cursor-pointer"
    >
      {copiedIndex === idx ? <Check weight="bold" className="w-3.5 h-3.5 text-status-online" /> : <Copy className="w-3.5 h-3.5" />}
      {copiedIndex === idx ? "已复制" : "复制"}
    </button>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-paper text-ink flex items-center justify-center px-5 py-12 relative font-sans pt-[max(3rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div ref={cardRef} className="w-full max-w-[380px] flex flex-col gap-7">
        <div data-login-stagger className="flex flex-col gap-3.5">
          <Logo size={40} />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold text-ink">登录 NodeMaster</h1>
            <p className="text-sm text-ink-secondary">多 VPS 节点管理与分流控制面板</p>
          </div>
        </div>

        {errorMsg && (
          <div role="alert" className="-mb-2 px-3 py-2.5 rounded-lg bg-status-danger-bg text-status-danger text-[13px] flex items-center gap-2">
            <WarningCircle weight="fill" className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-username" className="text-[13px] text-ink-secondary select-none">
              用户名
            </label>
            <div className="relative">
              <input
                id="admin-username"
                ref={usernameInputRef}
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (usernameError) setUsernameError(null);
                }}
                onKeyDown={handleUsernameKeyDown}
                placeholder="admin"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                enterKeyHint="next"
                aria-required="true"
                aria-invalid={!!usernameError}
                aria-describedby={usernameError ? "username-error-msg" : undefined}
                className={`${field(!!usernameError)} px-3 pr-11`}
              />
              {username.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearUsername}
                  tabIndex={-1}
                  aria-label="清空用户名"
                  className="absolute right-1 top-1 w-9 h-9 flex items-center justify-center rounded-md text-ink-muted hover:text-ink cursor-pointer"
                >
                  <XCircle weight="fill" className="w-4 h-4" />
                </button>
              )}
            </div>
            {usernameError && (
              <p id="username-error-msg" className="text-xs text-status-danger">
                {usernameError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between select-none">
              <label htmlFor="admin-password" className="text-[13px] text-ink-secondary">
                密码
              </label>
              {capsLockOn && (
                <span className="text-[11px] text-status-warning font-medium flex items-center gap-1">
                  <Warning weight="fill" className="w-3 h-3" aria-hidden="true" />
                  大写锁定已开启
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="admin-password"
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyDown}
                placeholder="••••••••"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="current-password"
                enterKeyHint="go"
                aria-required="true"
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "password-error-msg" : undefined}
                className={`${field(!!passwordError)} px-3 pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                className="absolute right-1 top-1 w-9 h-9 flex items-center justify-center rounded-md text-ink-secondary hover:text-ink cursor-pointer"
              >
                {showPassword ? <EyeSlash className="w-[17px] h-[17px]" aria-hidden="true" /> : <Eye className="w-[17px] h-[17px]" aria-hidden="true" />}
              </button>
            </div>
            {passwordError && (
              <p id="password-error-msg" className="text-xs text-status-danger">
                {passwordError}
              </p>
            )}
          </div>

          <label className="flex items-center gap-2.5 min-h-[32px] text-[13.5px] text-ink-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-accent-fill)] cursor-pointer"
            />
            保持登录 7 天
          </label>

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="h-11 rounded-lg bg-accent-fill text-white text-[14.5px] font-semibold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            {loading && <CircleNotch weight="bold" className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {loading ? "正在验证…" : "登录"}
          </button>
        </form>

        <details className="group border-t border-rule pt-4 text-[13px] text-ink-secondary">
          <summary className="cursor-pointer select-none hover:text-ink list-none flex items-center gap-1.5">
            <CaretRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
            忘记密码？
          </summary>
          <div className="mt-3 flex flex-col gap-3 leading-relaxed">
            <p>
              密码经 PBKDF2 单向散列存储在面板服务器上，无法通过邮件找回。请在服务器上操作：
            </p>
            <div className="flex flex-col gap-1.5">
              <span className="text-ink">从未改过密码：查看首次部署生成的凭据</span>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-paper-2 border border-rule">
                <code className="flex-1 min-w-0 overflow-x-auto font-mono text-xs text-ink-secondary whitespace-nowrap select-all">
                  cat /opt/nodemaster/data/bootstrap-admin.txt
                </code>
                <CopyBtn text="cat /opt/nodemaster/data/bootstrap-admin.txt" idx={1} label="复制查看凭据命令" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-ink">已改过密码：设置恢复变量并重启</span>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-paper-2 border border-rule">
                <code className="flex-1 min-w-0 overflow-x-auto font-mono text-xs text-ink-secondary whitespace-nowrap select-all">
                  NODEMASTER_RESET_ADMIN_PASSWORD="新的强密码"
                </code>
                <CopyBtn text={'NODEMASTER_RESET_ADMIN_PASSWORD="新的强密码"'} idx={2} label="复制重置变量" />
              </div>
              <span className="text-xs text-ink-muted">重启后密码被重置、旧会话全部失效。生效后请立即删除该变量。</span>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};
