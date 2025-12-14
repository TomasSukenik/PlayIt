"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // The OAuth callback will be handled by the DJ page
    // Just redirect there with the query params
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (code && state) {
      router.push(`/dj?code=${code}&state=${state}`);
    } else if (error) {
      router.push(`/dj?error=${error}`);
    } else {
      router.push("/dj");
    }
  }, [router]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#0a0a0b",
        color: "#e8e8e8",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: "3px solid #1db954",
            borderTopColor: "transparent",
            borderRadius: "50%",
            margin: "0 auto 1rem",
            animation: "spin 1s linear infinite",
          }}
        />
        <p>Connecting to Spotify... Redirecting to DJ Dashboard</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
