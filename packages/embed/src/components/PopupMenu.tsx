import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useCloseOnOutside } from "../hooks/useCloseOnOutside.js";

export function PopupMenu({
  label,
  icon,
  role = "menu",
  placement = "above",
  children,
}: {
  label: string;
  icon: JSX.Element;
  role?: "menu" | "dialog";
  placement?: "above" | "below";
  children: (close: () => void) => ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useCloseOnOutside(menuRef, open, () => setOpen(false));

  return (
    <div className="popup-menu" ref={menuRef}>
      <button
        className="icon-button"
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup={role}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {icon}
      </button>
      {open && (
        <div
          className={`popup-menu-dropdown ${placement}`}
          role={role}
          aria-label={label}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
