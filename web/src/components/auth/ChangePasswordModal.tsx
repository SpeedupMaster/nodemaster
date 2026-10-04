import React, { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { LockKey, CheckCircle, WarningCircle, Eye, EyeSlash } from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { changePassword } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetForm = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!oldPassword) {
      setErrorMsg("请输入当前原密码");
      return;
    }
    if (!newPassword) {
      setErrorMsg("请输入新密码");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg("新密码长度不能少于 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("两次输入的新密码不一致");
      return;
    }

    setLoading(true);
    const result = await changePassword(oldPassword, newPassword);
    setLoading(false);

    if (result.success) {
      setSuccessMsg("管理员密码修改成功！");
      setTimeout(() => {
        handleClose();
      }, 1200);
    } else {
      setErrorMsg(result.message || "修改密码失败，请检查原密码是否正确");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="修改管理员密码" maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <WarningCircle weight="bold" className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle weight="bold" className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Old password */}
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">
            当前原密码
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
              <LockKey className="w-4 h-4" />
            </div>
            <input
              type={showOld ? "text" : "password"}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="请输入当前原密码"
              className="w-full pl-9 pr-10 py-2 bg-paper border border-rule rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent font-mono"
            />
            <button
              type="button"
              onClick={() => setShowOld(!showOld)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-muted hover:text-ink"
              tabIndex={-1}
            >
              {showOld ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New password */}
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">
            新密码 (至少 6 位)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
              <LockKey className="w-4 h-4" />
            </div>
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码"
              className="w-full pl-9 pr-10 py-2 bg-paper border border-rule rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent font-mono"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-muted hover:text-ink"
              tabIndex={-1}
            >
              {showNew ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm new password */}
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">
            确认新密码
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
              <LockKey className="w-4 h-4" />
            </div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
              className="w-full pl-9 pr-3 py-2 bg-paper border border-rule rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent font-mono"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={handleClose}>
            取消
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            loading={loading}
            icon={<CheckCircle weight="bold" className="w-4 h-4" />}
          >
            确认更新密码
          </Button>
        </div>
      </form>
    </Modal>
  );
};
