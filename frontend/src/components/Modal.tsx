import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps { open: boolean; onClose: () => void; title: string; width?: number; children: ReactNode; }

export default function Modal({ open, onClose, title, width = 480, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      prevFocus.current = document.activeElement as HTMLElement;
      setTimeout(() => {
        modalRef.current?.querySelector<HTMLElement>('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])')?.focus();
      }, 50);
    } else { prevFocus.current?.focus(); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const m = modalRef.current; if (!m) return;
      const f = m.querySelectorAll<HTMLElement>('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])');
      if (f.length === 0) return;
      if (e.shiftKey) { if (document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } }
      else { if (document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); } }
    };
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, [open]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"; else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 0.15s ease" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label={title} style={{
        background: "var(--s1)", borderRadius: 14, width: "100%", maxWidth: width, maxHeight: "85vh",
        display: "flex", flexDirection: "column", boxShadow: "0 16px 48px rgba(0,0,0,0.12)", animation: "scaleIn 0.2s ease", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--b1)", flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>{title}</span>
          <button onClick={onClose} aria-label="Fermer" style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", width: 28, height: 28, borderRadius: 6, display: "grid", placeItems: "center", transition: "all 0.1s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--s2)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/></svg>
          </button>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

/* ═══ Form primitives ═══ */

export const formLabel: React.CSSProperties = {
  fontSize: 13, color: "var(--t1)", fontWeight: 500,
  display: "block", marginBottom: 6,
};

export const formInput: React.CSSProperties = {
  width: "100%", background: "var(--s2)", border: "1px solid var(--b2)",
  borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "var(--t1)",
  outline: "none", transition: "border-color 0.15s",
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
      {error && <p style={{ fontSize: 12, color: "var(--re)", marginTop: 4 }}>{error}</p>}
    </div>
  );
}

export function FormActions({ onCancel, onSubmit, submitLabel, submitting, disabled }: {
  onCancel: () => void; onSubmit: () => void; submitLabel: string; submitting?: boolean; disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
      <button onClick={onCancel} style={{
        padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500,
        cursor: "pointer", border: "1px solid var(--b2)", background: "var(--s1)", color: "var(--t2)", transition: "all 0.12s",
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--b3)"; (e.currentTarget as HTMLElement).style.color = "var(--t1)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--b2)"; (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}
      >Annuler</button>
      <button onClick={onSubmit} disabled={submitting || disabled} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
        cursor: (submitting || disabled) ? "not-allowed" : "pointer",
        border: "none", background: "var(--t1)", color: "#fff",
        opacity: (submitting || disabled) ? 0.4 : 1, transition: "all 0.15s",
      }}>
        {submitting && <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.6s linear infinite" }} />}
        {submitLabel}
      </button>
    </div>
  );
}