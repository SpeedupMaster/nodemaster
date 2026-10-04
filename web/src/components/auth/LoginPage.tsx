import React, { useState, useRef, useEffect } from "react";
import {
  LockKey,
  User,
  Eye,
  EyeSlash,
  ShareNetwork,
  WarningCircle,
  ArrowRight,
  Warning,
  Circle,
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
  const [capsLockOn, setCapsLockOn] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 20, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "power3.out" }
      );
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      triggerErrorShake("请输入管理员账号");
      return;
    }
    if (!password) {
      triggerErrorShake("请输入管理密码");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const result = await login(username.trim(), password);
    setLoading(false);

    if (result.success) {
      onLoginSuccess?.();
    } else {
      triggerErrorShake(result.message || "账号或密码错误，请核对后重试");
    }
  };

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden select-none font-sans">
      {/* Background Cyber Tech Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#38bdf807_1px,transparent_1px),linear-gradient(to_bottom,#38bdf807_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none" />

      {/* Atmospheric Ambient Glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[340px] bg-gradient-to-tr from-sky-500/10 via-blue-600/15 to-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Glassmorphism Login Card */}
      <div
        ref={cardRef}
        className="relative z-10 w-full max-w-[400px] bg-[#0c101a]/95 border border-slate-800/90 rounded-2xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85),0_0_35px_-8px_rgba(56,189,248,0.12)] p-7 backdrop-blur-2xl"
      >
        {/* Subtle Top Inner Highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/35 to-transparent rounded-t-2xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          {/* Logo with Soft Radiant Glow */}
          <div className="relative mb-3.5">
            <div className="absolute inset-0 bg-sky-500/30 blur-lg rounded-2xl" />
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/25 border border-sky-300/30">
              <ShareNetwork weight="fill" className="w-6 h-6 text-white drop-shadow" />
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            NodeMaster
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            多 VPS 节点分流控制中心 · 管理员鉴权网关
          </p>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2.5">
            <WarningCircle weight="fill" className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="leading-tight font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              管理员账号
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-sky-400 transition-colors">
                <User weight="bold" className="w-4 h-4" />
              </div>
              <input
                type="text"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入管理员用户名"
                className="w-full pl-10 pr-3 py-2.5 bg-[#06080e] border border-slate-800 rounded-xl text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all font-mono"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                管理密码
              </label>
              {capsLockOn && (
                <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1 font-mono">
                  <Warning weight="fill" className="w-3 h-3" />
                  大写锁定开启
                </span>
              )}
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-sky-400 transition-colors">
                <LockKey weight="bold" className="w-4 h-4" />
              </div>
              <input
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyDown}
                placeholder="请输入管理密码"
                className="w-full pl-10 pr-10 py-2.5 bg-[#06080e] border border-slate-800 rounded-xl text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
                title={showPassword ? "隐藏密码" : "显示密码"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeSlash className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me Option */}
          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-300 transition-colors">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-sky-500/30 cursor-pointer"
              />
              <span>保持登录状态 (7天)</span>
            </label>
            <span className="text-[11px] text-slate-500">免密自动连接</span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 mt-2 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:via-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-medium rounded-xl shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Circle className="w-4 h-4 animate-spin text-white" />
                <span>正在验证安全凭据...</span>
              </>
            ) : (
              <>
                <span>登录控制台</span>
                <ArrowRight weight="bold" className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

