import { useNavigate } from "react-router-dom";
import { useCallback, useRef, useState } from "react";
import type { AgentProfile } from "../data/agents";
import { useHomeLiquidGlass } from "../hooks/useHomeLiquidGlass";
import { useSafeViewport } from "../hooks/useSafeViewport";
import { armLiveCallFromGesture } from "../lib/liveCallBootstrap";
import { AgentGrid } from "./AgentGrid";
import { HireMeButton } from "./HireMeButton";
import { HomeMenu } from "./HomeMenu";

/** Contained Home → call exit duration (honors prefers-reduced-motion). */
export const HOME_EXIT_MS = 420;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function HomeScreen() {
  const navigate = useNavigate();
  useSafeViewport();
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMorphing, setMenuMorphing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const exitLockRef = useRef(false);

  const { refreshImmediate, recapture, destroy } = useHomeLiquidGlass({
    scrollRef,
    menuMorphing,
  });

  const handleMorphingChange = useCallback((morphing: boolean) => {
    setMenuMorphing(morphing);
  }, []);

  const handleMenuOpenChange = useCallback(
    (open: boolean) => {
      if (exiting) return;
      setMenuOpen(open);
      if (!open) {
        recapture();
      }
    },
    [exiting, recapture],
  );

  const handleCall = useCallback(
    (agent: AgentProfile) => {
      if (exitLockRef.current) return;
      exitLockRef.current = true;

      setMenuOpen(false);
      setExiting(true);

      // Live (Garry): warm media + arm auto-start in this tap, then navigate
      // immediately (no exit wait). Busy keeps the exit animation.
      if (agent.availability === "live") {
        armLiveCallFromGesture();
        destroy();
        navigate(`/call/${agent.id}`);
        return;
      }

      void (async () => {
        const duration = prefersReducedMotion() ? 0 : HOME_EXIT_MS;
        await wait(duration);
        // Never keep Home + Call LiquidGL renderers active together.
        destroy();
        navigate(`/call/${agent.id}`);
      })();
    },
    [destroy, navigate],
  );

  return (
    <main
      className="home-screen"
      data-testid="home-screen"
      data-editing={editing ? "true" : "false"}
      data-menu={menuOpen ? "open" : "closed"}
      data-menu-morphing={menuMorphing ? "true" : "false"}
      data-exiting={exiting ? "true" : "false"}
    >
      {/* Title + cards inside snapshot; chrome targets stay outside. */}
      <div
        id="liquid-gl-snapshot"
        className="home-screen__snapshot home-screen__exit-layer"
      >
        <h1 className="home-screen__title">FaceTime</h1>
        <div
          ref={scrollRef}
          className="home-screen__scroll"
          data-testid="home-scroll"
        >
          <AgentGrid onCall={handleCall} disabled={exiting} />
        </div>
      </div>

      <div className="liquid-canvas-layer" aria-hidden="true" />

      <header className="home-screen__toolbar home-screen__exit-layer">
        <button
          type="button"
          className="home-edit-btn liquidGL"
          aria-label="Edit"
          aria-pressed={editing}
          data-testid="home-edit"
          disabled={exiting}
          onClick={() => {
            setEditing((value) => !value);
            refreshImmediate();
            recapture();
          }}
        >
          <span className="content">Edit</span>
        </button>

        <HomeMenu
          open={menuOpen && !exiting}
          onOpenChange={handleMenuOpenChange}
          onMorphingChange={handleMorphingChange}
          refreshImmediate={refreshImmediate}
        />
      </header>

      <div className="home-screen__cta home-screen__exit-layer">
        <HireMeButton />
      </div>
    </main>
  );
}
