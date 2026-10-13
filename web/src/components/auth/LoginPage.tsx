import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  LockKey,
  User,
  Eye,
  EyeSlash,
  ShareNetwork,
  WarningCircle,
  ArrowRight,
  Warning,
  CircleNotch,
  XCircle,
  Check,
  Question,
  Copy,
  X,
  CheckCircle,
  Key,
  ShieldCheck,
} from "@phosphor-icons/react";
import gsap from "gsap";
import { useAuth } from "../../context/AuthContext";

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
  const [showResetModal, setShowResetModal] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 16, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "power3.out" }
      );
    }
  }, []);

  // Smooth slide-up animation for reset modal drawer
  useEffect(() => {
    if (showResetModal && modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { y: 35, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.28, ease: "power3.out" }
      );
    }
  }, [showResetModal]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showResetModal) {
        setShowResetModal(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [showResetModal]);

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

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#070b13] text-slate-100 flex flex-col justify-center items-center px-6 sm:px-8 py-8 relative overflow-x-hidden overflow-y-auto font-sans pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* Background Cyber Tech Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#38bdf807_1px,transparent_1px),linear-gradient(to_bottom,#38bdf807_1px,transparent_1px)] bg-[size:32px_32px] sm:bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none" />

      {/* Atmospheric Ambient Glows (Immersive & focused) */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[540px] h-[340px] bg-gradient-to-tr from-blue-600/15 via-sky-500/15 to-indigo-600/10 rounded-full blur-[90px] sm:blur-[110px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[280px] h-[180px] bg-sky-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Main Login Form Area (Mobile: Frameless & Immersive; Desktop: Refined Glass Card) */}
      <div
        ref={cardRef}
        className="relative z-10 w-full max-w-[380px] sm:max-w-[420px] bg-transparent border-0 shadow-none p-0 sm:bg-[#0d121e]/95 sm:border sm:border-slate-700/80 sm:rounded-3xl sm:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.85)] sm:p-8 sm:backdrop-blur-2xl transition-all"
      >
        {/* Subtle Top Inner Highlight (Desktop Card only) */}
        <div className="hidden sm:block absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent rounded-t-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-7">
          {/* Logo with Tasteful Ambient Rim */}
          <div className="relative mb-3.5 sm:mb-4">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-900/40 border border-sky-300/30">
              <ShareNetwork weight="fill" className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow" aria-hidden="true" />
            </div>
          </div>

          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-white">
            NodeMaster
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-300 mt-1 max-w-xs leading-relaxed">
            多 VPS 节点分流控制中心 · 管理员鉴权网关
          </p>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs sm:text-[13px] flex items-center gap-2.5 animate-fadeIn"
          >
            <WarningCircle weight="fill" className="w-4 h-4 shrink-0 text-rose-400" aria-hidden="true" />
            <span className="leading-tight font-medium flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
          {/* Username Input Field */}
          <div>
            <label
              htmlFor="admin-username"
              className="block text-xs sm:text-[13px] font-medium text-slate-200 mb-1.5 select-none"
            >
              管理员账号
            </label>
            <div className="relative group">
              <div
                className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${
                  usernameError
                    ? "text-rose-400"
                    : "text-slate-300 group-focus-within:text-sky-400"
                }`}
                aria-hidden="true"
              >
                <User weight="bold" className="w-4.5 h-4.5" />
              </div>
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
                placeholder="请输入管理员用户名"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                enterKeyHint="next"
                aria-required="true"
                aria-invalid={!!usernameError}
                aria-describedby={usernameError ? "username-error-msg" : undefined}
                className={`w-full pl-10 pr-10 h-12 bg-[#070a12] border rounded-xl text-base sm:text-sm text-white placeholder:text-slate-400 placeholder:opacity-90 focus:outline-none transition-all font-mono ${
                  usernameError
                    ? "border-rose-500/90 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/25"
                    : "border-slate-700/80 hover:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                }`}
              />
              {username.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearUsername}
                  tabIndex={-1}
                  aria-label="清空用户名输入"
                  className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-slate-400 hover:text-slate-200 active:text-white transition-colors cursor-pointer touch-manipulation"
                  title="清空账号"
                >
                  <XCircle weight="fill" className="w-4.5 h-4.5" />
                </button>
              )}
            </div>
            {usernameError && (
              <p id="username-error-msg" className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 font-medium animate-fadeIn">
                <WarningCircle weight="fill" className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{usernameError}</span>
              </p>
            )}
          </div>

          {/* Password Input Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5 select-none">
              <label
                htmlFor="admin-password"
                className="block text-xs sm:text-[13px] font-medium text-slate-200"
              >
                管理密码
              </label>
              {capsLockOn && (
                <span className="text-[11px] text-amber-300 font-medium flex items-center gap-1 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  <Warning weight="fill" className="w-3 h-3 text-amber-400" aria-hidden="true" />
                  大写锁定开启
                </span>
              )}
            </div>
            <div className="relative group">
              <div
                className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${
                  passwordError
                    ? "text-rose-400"
                    : "text-slate-300 group-focus-within:text-sky-400"
                }`}
                aria-hidden="true"
              >
                <LockKey weight="bold" className="w-4.5 h-4.5" />
              </div>
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
                placeholder="请输入管理密码"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="current-password"
                enterKeyHint="go"
                aria-required="true"
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "password-error-msg" : undefined}
                className={`w-full pl-10 pr-12 h-12 bg-[#070a12] border rounded-xl text-base sm:text-sm text-white placeholder:text-slate-400 placeholder:opacity-90 focus:outline-none transition-all font-mono ${
                  passwordError
                    ? "border-rose-500/90 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/25"
                    : "border-slate-700/80 hover:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                role="switch"
                aria-checked={showPassword}
                aria-label={showPassword ? "隐藏密码" : "显示密码明文"}
                className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-slate-300 hover:text-white active:text-sky-400 transition-colors cursor-pointer touch-manipulation"
                title={showPassword ? "隐藏密码" : "显示密码"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeSlash weight="bold" className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Eye weight="bold" className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>
            {passwordError && (
              <p id="password-error-msg" className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 font-medium animate-fadeIn">
                <WarningCircle weight="fill" className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{passwordError}</span>
              </p>
            )}
          </div>

          {/* Clean Checkbox (Without trailing tag) */}
          <div
            role="checkbox"
            aria-checked={rememberMe}
            tabIndex={0}
            onClick={() => setRememberMe(!rememberMe)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setRememberMe(!rememberMe);
              }
            }}
            className="flex items-center gap-3 min-h-[44px] py-1 cursor-pointer select-none focus:outline-none"
          >
            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                rememberMe
                  ? "bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/30"
                  : "bg-[#070a12] border-slate-600 text-transparent"
              }`}
              aria-hidden="true"
            >
              <Check weight="bold" className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-300 hover:text-slate-200 transition-colors">
              保持登录状态 (7天)
            </span>
          </div>

          {/* Primary Action Button (Modern Cobalt Gradient, Clean & Tactile) */}
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full h-12 py-3 px-4 mt-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-medium text-base sm:text-sm rounded-xl shadow-md shadow-blue-950/40 transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation select-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#070b13]"
          >
            {loading ? (
              <>
                <CircleNotch weight="bold" className="w-4.5 h-4.5 animate-spin text-white" aria-hidden="true" />
                <span>正在验证凭据...</span>
              </>
            ) : (
              <>
                <span>登录控制台</span>
                <ArrowRight weight="bold" className="w-4.5 h-4.5 group-hover:translate-x-1 group-active:translate-x-1 transition-transform" aria-hidden="true" />
              </>
            )}
          </button>

          {/* Centered Forgot Password Link */}
          <div className="flex items-center justify-center pt-3 sm:pt-4 text-xs select-none">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="text-slate-400 hover:text-sky-300 active:text-sky-400 transition-colors flex items-center gap-1.5 py-1.5 px-2 rounded focus:outline-none focus:underline"
            >
              <Question className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>忘记管理密码？</span>
            </button>
          </div>
        </form>
      </div>

      {/* Accessible Reset Password Guide Modal (Mobile Bottom-Sheet / Desktop Centered Dialog) */}
      {showResetModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowResetModal(false)}
        >
          <div
            ref={modalRef}
            className="w-full max-w-lg bg-[#0e1322] border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-200 max-h-[92vh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))] transition-transform"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drawer Pull Indicator */}
            <div className="sm:hidden w-10 h-1 bg-slate-700/80 rounded-full mx-auto mb-4 shrink-0" aria-hidden="true" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-sky-400 flex items-center justify-center shrink-0">
                  <Key weight="bold" className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="reset-dialog-title" className="text-base font-semibold text-white tracking-tight">
                    重置管理员密码
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    基于零信任与本地密钥安全机制
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                aria-label="关闭指引弹窗"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X weight="bold" className="w-4 h-4" />
              </button>
            </div>

            {/* Security Callout */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200/90 text-xs leading-relaxed flex items-start gap-2.5 mb-4">
              <ShieldCheck weight="fill" className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                NodeMaster 密码经由 <strong className="text-white font-mono">PBKDF2</strong> 本地单向散列存储，不提供公网邮件找回。请通过服务器终端恢复凭证：
              </span>
            </div>

            {/* Methods Cards */}
            <div className="space-y-3.5 text-xs text-slate-300">
              {/* Method 1 */}
              <div className="bg-[#080c16] border border-slate-800/90 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    方法一：查看首次部署凭证
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                    免重启服务
                  </span>
                </div>
                <div className="relative bg-[#04060a] border border-slate-800/90 rounded-lg p-2.5 font-mono text-[11px] text-sky-300 flex items-center justify-between">
                  <span className="select-all overflow-x-auto pr-2">
                    cat /opt/nodemaster/data/bootstrap-admin.txt
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText("cat /opt/nodemaster/data/bootstrap-admin.txt", 1)}
                    aria-label="复制查看凭据命令"
                    className="shrink-0 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedIndex === 1 ? (
                      <>
                        <CheckCircle weight="fill" className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-sans">已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy weight="bold" className="w-3.5 h-3.5" />
                        <span className="font-sans">复制</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Method 2 */}
              <div className="bg-[#080c16] border border-slate-800/90 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    方法二：在服务端环境变量指定新密码
                  </span>
                  <span className="text-[10px] font-mono text-sky-400/90 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded">
                    覆盖重设
                  </span>
                </div>
                <div className="relative bg-[#04060a] border border-slate-800/90 rounded-lg p-2.5 font-mono text-[11px] text-slate-300 flex items-center justify-between">
                  <div className="select-all overflow-x-auto pr-2 leading-relaxed">
                    <span className="text-slate-500"># 注入新密码并重启服务</span><br />
                    <span className="text-amber-300">export NODEMASTER_ADMIN_PASSWORD="新密码"</span><br />
                    <span>pnpm start</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText('export NODEMASTER_ADMIN_PASSWORD="新密码" && pnpm start', 2)}
                    aria-label="复制重设密码命令"
                    className="shrink-0 self-start px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedIndex === 2 ? (
                      <>
                        <CheckCircle weight="fill" className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-sans">已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy weight="bold" className="w-3.5 h-3.5" />
                        <span className="font-sans">复制</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Full-Width Ergonomic Primary Action Button */}
            <div className="mt-5 pt-3.5 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="w-full h-12 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white rounded-xl text-sm font-medium transition-all shadow-md flex items-center justify-center cursor-pointer select-none"
              >
                我知道了，返回登录
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


