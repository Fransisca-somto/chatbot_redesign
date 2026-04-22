"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "../admin.css"; // We'll share some styles here

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        // Redirect to admin dashboard
        window.location.href = "/admin"; 
        // Using window.location instead of router.push to force a full re-evaluation of the layout's auth check
      } else {
        const data = await res.json();
        setError(data.error || "Incorrect password");
      }
    } catch (err) {
      setError("An error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <h2>Admin Dashboard</h2>
          <p>Sign in to manage WhatsApp conversations</p>
        </div>
        <form onSubmit={handleLogin} className="admin-login-form">
          <input
            type="password"
            placeholder="Enter Admin Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            autoFocus
          />
          {error && <div className="admin-login-error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}
