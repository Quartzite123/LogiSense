// Toast stack (UI_DESIGN_SPEC §8). Top-right, slide-in. Success auto-dismisses;
// errors stay until closed (handled by the caller in context/ui.jsx).
export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed right-4 top-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-in"
          style={{
            minWidth: 260,
            maxWidth: 380,
            background: '#0F0F11',
            border: '1px solid #27272A',
            borderLeft: `3px solid ${t.type === 'success' ? '#4ADE80' : '#F87171'}`,
            borderRadius: 8,
            padding: '12px 14px',
            color: '#F8F8F8',
            fontSize: 13,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <span>{t.message}</span>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-[#8A8A93] transition-colors hover:text-[#F8F8F8]"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
