import { HIRE_ME_URL } from "../data/homeLinks";
import { HomeSymbolIcon } from "./HomeSymbolIcon";

interface HireMeButtonProps {
  className?: string;
}

export function HireMeButton({ className = "" }: HireMeButtonProps) {
  return (
    <a
      className={`hire-me-button liquidGL ${className}`.trim()}
      href={HIRE_ME_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hire me"
      data-testid="hire-me-button"
    >
      <span className="hire-me-button__solid" aria-hidden="true" />
      <span className="content hire-me-button__content">
        <HomeSymbolIcon name="camera-on" size={14} />
        <span className="hire-me-button__label">Hire me</span>
      </span>
    </a>
  );
}
