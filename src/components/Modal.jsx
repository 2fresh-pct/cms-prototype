export default function Modal({ open, onClose, title, children, footer, maxWidth = "max-w-sm" }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-lg border border-gray-300 bg-white p-5 wf-pop`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="mb-4 text-base font-semibold text-gray-900">{title}</h2>}
        <div className="text-sm text-gray-600">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
