import { hapticTap } from "../lib/liquidGlass";

interface MoreSheetProps {
  onClose: () => void;
}

const ACTIONS = [
  "Share Mini Pho",
  "Show Captions",
  "Report a Problem",
] as const;

export function MoreSheet({ onClose }: MoreSheetProps) {
  return (
    <div
      className="sheet-backdrop"
      role="presentation"
      onClick={onClose}
      data-testid="more-sheet"
    >
      <div
        className="sheet"
        role="dialog"
        aria-label="More options"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet__handle liquidGL" aria-hidden />
        {ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            className="sheet__action"
            onClick={() => {
              hapticTap();
              onClose();
            }}
          >
            {action}
          </button>
        ))}
        <button
          type="button"
          className="sheet__action sheet__action--cancel"
          onClick={() => {
            hapticTap();
            onClose();
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
