import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onSave: (v: string) => void;
  onCancel?: () => void;
  className?: string;
  placeholder?: string;
  autoSize?: boolean;
};

export function InlineEdit({ value, onSave, onCancel, className, placeholder, autoSize }: Props) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) onCancel?.();
    else onSave(trimmed);
  };

  const size = autoSize ? Math.max(2, draft.length) : undefined;

  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel?.();
        }
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={className}
      placeholder={placeholder}
      size={size}
      dir="auto"
    />
  );
}
