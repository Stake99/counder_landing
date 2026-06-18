import * as React from "react";

/**
 * Placeholder transactional template — the invite to join Counder. Passed to
 * Resend's `react` option (which renders any React element to HTML), so it needs
 * no extra email-component dependency yet. TODO: migrate to React Email
 * primitives (`@react-email/components`) and wire to the invite flow.
 */
export function InviteEmail({
  name = "there",
  url = "https://counder.com",
}: {
  name?: string;
  url?: string;
}) {
  return (
    <div
      style={{
        fontFamily: "Manrope, system-ui, sans-serif",
        color: "#000",
        maxWidth: 520,
        margin: "0 auto",
        padding: "40px 24px",
      }}
    >
      <p
        style={{
          fontFamily: "monospace",
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          fontSize: 12,
          color: "#666",
        }}
      >
        Counder · January 2027 · Cape Town
      </p>
      <h1 style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.15, marginTop: 16 }}>
        You&rsquo;re invited to join the network for collective understanding.
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: "#444", marginTop: 16 }}>
        Hi {name}, 500 perspectives from all over the world, in one place — once a
        year, in Cape Town. Confirm your place to continue.
      </p>
      <a
        href={url}
        style={{
          display: "inline-block",
          marginTop: 24,
          padding: "13px 26px",
          borderRadius: 100,
          background: "#000",
          color: "#fff",
          textDecoration: "none",
          fontSize: 14,
        }}
      >
        Accept invitation
      </a>
    </div>
  );
}
