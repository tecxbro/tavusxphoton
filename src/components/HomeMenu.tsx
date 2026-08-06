import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { HOME_LINKS, type HomeMenuItem } from "../data/homeLinks";
import { useLayoutMorph } from "../hooks/useLayoutMorph";
import { HomeSymbolIcon } from "./HomeSymbolIcon";

const MENU_MORPH_MS = 320;

interface HomeMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMorphingChange: (morphing: boolean) => void;
  refreshImmediate: () => void;
}

function CheckIcon() {
  return <HomeSymbolIcon name="check" size={14} className="home-menu__check" />;
}

export function HomeMenu({
  open,
  onOpenChange,
  onMorphingChange,
  refreshImmediate,
}: HomeMenuProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const setMorphing = useCallback(
    (value: boolean) => {
      onMorphingChange(value);
    },
    [onMorphingChange],
  );

  useLayoutMorph(shellRef, {
    activeKey: open ? "open" : "closed",
    durationMs: MENU_MORPH_MS,
    onStart: () => {
      setMorphing(true);
      refreshImmediate();
    },
    onFrame: () => {
      // Lens metrics only — never recapture mid-morph.
      refreshImmediate();
    },
    onFinish: () => {
      refreshImmediate();
      setMorphing(false);
    },
  });

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Outside pointer + Escape. No visible dim layer.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const shell = shellRef.current;
      if (!shell) return;
      if (event.target instanceof Node && shell.contains(event.target)) {
        return;
      }
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // Return focus to the trigger after close.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  const handleSelect = (item: HomeMenuItem) => {
    if (item.href) {
      window.open(item.href, "_blank", "noopener,noreferrer");
    }
    close();
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      onOpenChange(true);
    }
  };

  return (
    <div
      className={`home-menu ${open ? "is-open" : ""}`.trim()}
      data-testid="home-menu"
      data-open={open ? "true" : "false"}
    >
      {/* Single LiquidGL target — morphs 44×44 ↔ ~260×212, top-right anchored. */}
      <div
        ref={shellRef}
        className="home-menu__shell liquidGL"
        data-testid="home-menu-shell"
      >
        <div className="content home-menu__content">
          <button
            ref={triggerRef}
            type="button"
            className="home-menu__trigger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-controls="home-menu-panel"
            data-testid="home-menu-toggle"
            onClick={() => onOpenChange(!open)}
            onKeyDown={onTriggerKeyDown}
          >
            <HomeSymbolIcon name="menu" size={18} />
          </button>

          <div
            id="home-menu-panel"
            className="home-menu__list"
            role="menu"
            aria-label="Home menu"
            aria-hidden={!open}
            data-testid="home-menu-panel"
            hidden={!open}
          >
            {HOME_LINKS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="home-menu__item"
                role="menuitem"
                tabIndex={open ? 0 : -1}
                data-selected={item.selected ? "true" : undefined}
                onClick={() => handleSelect(item)}
              >
                <span className="home-menu__item-label">{item.label}</span>
                {item.selected ? <CheckIcon /> : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
