import { hapticTap } from "../lib/haptics";

interface ParticipantSheetProps {
  name: string;
  avatar: string;
  onClose: () => void;
}

export function ParticipantSheet({
  name,
  avatar,
  onClose,
}: ParticipantSheetProps) {
  return (
    <div
      className="sheet-backdrop"
      role="presentation"
      onClick={onClose}
      data-testid="participant-sheet"
    >
      <div
        className="sheet"
        role="dialog"
        aria-label={`${name} information`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet__handle liquidGL" aria-hidden />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <img
            src={avatar}
            alt=""
            width={56}
            height={56}
            style={{ borderRadius: "50%", objectFit: "cover" }}
          />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{name}</div>
            <div style={{ opacity: 0.7, fontSize: 15 }}>Photon Agent</div>
          </div>
        </div>
        <button
          type="button"
          className="sheet__action sheet__action--cancel"
          onClick={() => {
            hapticTap();
            onClose();
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
