import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { login } from "../../auth/authApi";
import { getSession, setSession } from "../../auth/authStorage";
import "./LoginPage.css";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const existing = getSession();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (existing) {
    return <Navigate to="/live" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("请输入账号");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }

    setLoading(true);
    try {
      const session = await login(username, password);
      setSession(session);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/live", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-frame" aria-hidden />
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <div className="login-brand">
          <div className="login-logo" aria-label="IMC">
            IM<span>C</span>
          </div>
          <h1>Industrial Monitoring Center</h1>
          <p className="login-title-cn">智能工厂监控中心</p>
        </div>

        <label className="sr-only" htmlFor="imc-username">
          Username
        </label>
        <input
          id="imc-username"
          className="login-input"
          autoComplete="username"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
        />

        <label className="sr-only" htmlFor="imc-password">
          Password
        </label>
        <input
          id="imc-password"
          className="login-input"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />

        <div className="login-role-hint">Observer / Operator</div>

        {error ? <div className="login-error">{error}</div> : null}

        <button className="login-submit" type="submit" disabled={loading}>
          {loading ? "登录中…" : "Sign In / 登录"}
        </button>

        <p className="login-hint">
          试用：observer / observer123 · admin / admin123
        </p>
      </form>

      <footer className="login-footer">Workshop A · MQTT Live</footer>
    </div>
  );
}
