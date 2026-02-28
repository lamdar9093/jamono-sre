import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, width = 480, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // ── Save previous focus + auto-focus first input ──
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      // Small delay so DOM is painted
      setTimeout(() => {
        const first = modalRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
        );
        first?.focus();
      }, 50);
    } else {
      previousFocus.current?.focus();
    }
  }, [open]);

  // ── Escape key ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // ── Focus trap ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // ── Block body scroll ──
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
        animation: "fadeIn 0.15s ease",
      }}
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          background: "var(--s1)",
          border: "1px solid var(--b2)",
          borderRadius: 14,
          width: "100%",
          maxWidth: width,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          animation: "scaleIn 0.2s ease",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid var(--b1)",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>{title}</span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: "none", border: "none", color: "var(--t3)", cursor: "pointer",
              width: 28, height: 28, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.1s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/>
            </svg>
          </button>
        </div>

        {/* Content — scrollable */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}


/* ═══ Reusable form primitives ═══ */

export const formLabel: React.CSSProperties = {
  fontFamily: "var(--fm)", fontSize: 10, color: "var(--t3)",
  textTransform: "uppercase", letterSpacing: "0.08em",
  display: "block", marginBottom: 6, fontWeight: 600,
};

export const formInput: React.CSSProperties = {
  width: "100%", background: "var(--s2)", border: "1px solid var(--b2)",
  borderRadius: "var(--r)", padding: "8px 12px",
  fontFamily: "var(--fm)", fontSize: 12, color: "var(--t1)", outline: "none",
  transition: "border-color 0.15s",
};

export function FormField({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: ReactNode;
}) {
  return (
    <div>
      <label style={formLabel}>
        {label}{required && <span style={{ color: "var(--re)", marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {error && (
        <p style={{
          fontFamily: "var(--fm)", fontSize: 10, color: "var(--re)",
          marginTop: 4, display: "flex", alignItems: "center", gap: 4,
          animation: "slideIn 0.15s ease",
        }}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="8" cy="8" r="6"/><path d="M8 5v3M8 10.5v.5"/>
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

export function FormActions({ onCancel, onSubmit, submitLabel, submitting, disabled }: {
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitting?: boolean;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
      <button onClick={onCancel} style={{
        padding: "8px 18px", borderRadius: "var(--r)",
        fontFamily: "var(--f)", fontSize: 13, fontWeight: 500,
        cursor: "pointer", border: "1px solid var(--b2)",
        background: "transparent", color: "var(--t2)",
        transition: "all 0.12s",
      }}>Annuler</button>
      <button
        onClick={onSubmit}
        disabled={submitting || disabled}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 18px", borderRadius: "var(--r)",
          fontFamily: "var(--f)", fontSize: 13, fontWeight: 600,
          cursor: (submitting || disabled) ? "not-allowed" : "pointer",
          border: "none",
          background: "var(--brand)", color: "#fff",
          opacity: (submitting || disabled) ? 0.5 : 1,
          boxShadow: "0 2px 10px rgba(59,130,246,0.3)",
          transition: "all 0.15s",
        }}
      >
        {submitting && (
          <div style={{
            width: 12, height: 12, borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.3)",
            borderTopColor: "#fff",
            animation: "spin 0.6s linear infinite",
          }} />
        )}
        {submitLabel}
      </button>
    </div>
  );
}