import React, { useEffect, useMemo, useRef, useState } from "react";

import useAppStore, { GamePhase } from "../../zustand/store";
import { useStarknetConnect } from "../../dojo/hooks/useStarknetConnect";
import { useGameData } from "../../dojo/hooks/useGameData";
import { useInitializePlayer } from "../../dojo/hooks/useInitializePlayer";
import { useStartGame } from "../../dojo/hooks/useStartGame";
import { TutorialVideo } from "./TutorialVideo";
import { useEndGame } from "../../dojo/hooks/useEndGame";


type Move = "up" | "down" | "left" | "right";

const BGM_SRC = "/audio/mainmenu.mp3";

export function MainMenu(): JSX.Element {
  // Poll refetch until the session flag in store flips to "not active" (or timeout).
const pollRefetchUntilInactive = async (
  refetchFn: () => Promise<any>,
  maxTries = 12,
  gapMs = 350
): Promise<void> => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // read from zustand without re-render dependency
  const isActive = () => {
    const s = useAppStore.getState();
    // treat either UI phase ACTIVE or player.game_active as "active"
    return s.gamePhase === GamePhase.ACTIVE || Boolean(s.player?.game_active);
  };

  for (let i = 0; i < maxTries; i++) {
    await refetchFn();         // ask hooks to reload latest on-chain state
    await sleep(gapMs);        // let state propagate to store/UI
    if (!isActive()) return;   // stop as soon as it’s inactive
  }
};

    // BGM refs/state
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const [bgmReady, setBgmReady] = useState(false);
  const [bgmPlaying, setBgmPlaying] = useState(false);

  // Prepare and aggressively autoplay on page load
  useEffect(() => {
    const a = new Audio(BGM_SRC);
    a.loop = true;
    a.preload = "auto";
    a.volume = 0.6;
    a.crossOrigin = "anonymous";
    bgmRef.current = a;

    const onCanPlay = () => setBgmReady(true);
    a.addEventListener("canplaythrough", onCanPlay);

    let unlocked = false;

    const clearUnlockers = () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      document.removeEventListener("visibilitychange", onVis);
    };

    const markPlaying = () => {
      if (!unlocked) {
        unlocked = true;
        setBgmPlaying(true);
        clearUnlockers();
      }
    };

    const tryAutoplay = async () => {
      if (!bgmRef.current) return;
      try {
        // Chrome allows muted autoplay; unmute after starting.
        a.muted = true;
        await a.play();
        markPlaying();
        // Unmute shortly after stable start
        setTimeout(() => {
          if (bgmRef.current) bgmRef.current.muted = false;
        }, 150);
      } catch {
        // Autoplay blocked: wait for first user gesture
      }
    };

    const unlock = () => {
      if (!bgmRef.current || unlocked) return;
      // Start with muted= false here; the gesture should permit audio
      bgmRef.current.muted = false;
      bgmRef.current.play().then(markPlaying).catch(() => void 0);
    };

    const onVis = () => {
      if (document.visibilityState === "visible" && !unlocked) {
        tryAutoplay();
      }
    };

    // Attempt immediately if visible; otherwise on first visibility
    if (document.visibilityState === "visible") {
      void tryAutoplay();
    } else {
      document.addEventListener("visibilitychange", onVis);
    }

    // Fallback unlockers if autoplay is blocked
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });

    return () => {
      clearUnlockers();
      a.removeEventListener("canplaythrough", onCanPlay);
      a.pause();
      // @ts-ignore
      bgmRef.current = null;
    };
  }, []);

  // Start on first meaningful click to satisfy autoplay policies
  const ensureBgm = async (): Promise<void> => {
    if (!bgmRef.current || bgmPlaying === true) return;
    try {
      // Some browsers require play() to be directly in a user gesture call chain
      await bgmRef.current.play();
      setBgmPlaying(true);
    } catch {}
  };

  // Fade out BGM and stop
  const stopBgmWithFade = (ms: number = 700): void => {
    const a = bgmRef.current;
    if (!a) return;
    const startVol = a.volume;
    const steps = 14;
    const step = Math.max(1, Math.floor(ms / steps));
    let i = 0;
    const id = setInterval(() => {
      i++;
      const v = Math.max(0, startVol * (1 - i / steps));
      a.volume = v;
      if (i >= steps) {
        clearInterval(id);
        a.pause();
        a.currentTime = 0;
        a.volume = startVol;
        setBgmPlaying(false);
      }
    }, step);
  };

  const { status, address, handleConnect, isConnecting } = useStarknetConnect();
  const { playerStats, isLoading: playerLoading, refetch } = useGameData();
  const {
    initializePlayer,
    isLoading: initializing,
    canInitialize,
  } = useInitializePlayer();
  const { startGame, isLoading: startingGame, canStartGame } = useStartGame();
  const { endGame, canEndGame } = useEndGame();

  const {
    setConnectionStatus,
    setLoading,
    gamePhase,
    player,
    startGame: startGameUI,
  } = useAppStore();

  const isConnected = status === "connected";
  const hasPlayerStats = playerStats !== null;
  const isLoading =
    isConnecting || playerLoading || initializing || startingGame;

  const images = useMemo(
    () => [
      "/bk1.png",
      "/bk2.png",
      "/bk3.png",
      "/bk4.png",
      "/bk5.png",
      "/bk6.png",
    ],
    []
  );
  const [bg, setBg] = useState(0);
  const [dir, setDir] = useState<Move>("up");
  const [showTutorial, setShowTutorial] = useState(false);
    const [hovered, setHovered] = useState<number | null>(null);

  // Tutorial flow states
  const [showBlackScreen, setShowBlackScreen] = useState(false);
  const [showTutorialVideo, setShowTutorialVideo] = useState(false);

  // Handle tutorial sequence: black screen (4s) -> video -> game
  useEffect(() => {
    if (showBlackScreen) {
      const timer = setTimeout(() => {
        setShowBlackScreen(false);
        setShowTutorialVideo(true);
      }, 4000); // 4 seconds
      return () => clearTimeout(timer);
    }
  }, [showBlackScreen]);

  // Handle ESC key to skip tutorial
  useEffect(() => {
    if (!showBlackScreen && !showTutorialVideo) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.code === "Escape") {
        setShowBlackScreen(false);
        setShowTutorialVideo(false);
        startGameUI();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showBlackScreen, showTutorialVideo, startGameUI]);

  useEffect(() => {
    setConnectionStatus(
      status === "connected"
        ? "connected"
        : isConnecting
        ? "connecting"
        : "disconnected"
    );
  }, [status, isConnecting, setConnectionStatus]);

  useEffect(() => setLoading(isLoading), [isLoading, setLoading]);

  // tiny ambient background swapper
  useEffect(() => {
    const t = setInterval(() => {
      setBg((b) => (b + 1) % images.length);
      setDir((d) => (d === "up" ? "down" : "up"));
    }, 5000);
    return () => clearInterval(t);
  }, [images.length]);

  const canEnterGame = isConnected && hasPlayerStats && !startingGame;
  const gameAlreadyActive =
    gamePhase === GamePhase.ACTIVE || (player as any)?.game_active;

const handlePlayForFree = async (): Promise<void> => {
  await ensureBgm();

  // Step 1: Connect wallet if not connected
  if (!isConnected) {
    await handleConnect();
    await new Promise((r) => setTimeout(r, 1500));
    await refetch();
    return; // Let user click again after connecting
  }

  // Step 2: Initialize player if needed
  if (!hasPlayerStats && canInitialize) {
    const res = await initializePlayer();
    if (res?.success) {
      await new Promise((r) => setTimeout(r, 2000));
      await refetch();
    }
    return; // Let user click again after initializing
  }

  // Step 3: Enter the game (with session cleanup if needed)
  stopBgmWithFade(700);

  // If a previous session is still active, end it first (backend "Press B")
  if (gameAlreadyActive && canEndGame) {
    try {
      await endGame();
    } catch {
      // ignore; proceed to refresh and start
    }

    // HARD REFRESH OF FRONTEND STATE: refetch until store no longer marks session active
    try {
      await pollRefetchUntilInactive(refetch, 12, 350);
    } catch {
      // even if polling fails, still move on
    }
  }

  // Start a fresh session if allowed
  if (canStartGame) {
    try {
      await startGame();
      // One extra refetch burst so HUD shows brand-new session values immediately
      await refetch();
      await new Promise((r) => setTimeout(r, 250));
      await refetch();
    } catch {
      // swallow; UI flow continues
    }
  }

  // Start tutorial sequence: black screen -> video -> game
  setShowBlackScreen(true);
};



    

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: `url(${images[bg]})`,
        backgroundSize: "cover",
               backgroundPosition: "right center",

      }}
    >
 
          <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "flex-start",
        }}
      >
        {/* left dark fade panel only (no full overlay) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.75) 18%, rgba(0,0,0,0.55) 32%, rgba(0,0,0,0.0) 55%)",
            pointerEvents: "none",
          }}
        />

        {/* left menu column */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: 920,
            padding: "396px 260px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            color: "white",
            userSelect: "none",
          }}
        >
          

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* PLAY FOR FREE — handles everything */}
            <button
              onClick={handlePlayForFree}
              disabled={isLoading}
              style={{
                all: "unset",
                cursor: isLoading ? "not-allowed" : "pointer",
                fontSize: 18,
                letterSpacing: 1,
                padding: "2px 0",
              }}
            >
              <span
                style={{
                  background: "#FFFFFF",
                  color: "#000000",
                  borderRadius: 8,
                  padding: "8px 14px",
                  boxShadow: "0 2px 0 rgba(0,0,0,0.35)",
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? "LOADING..." : "PLAY FOR FREE"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {showTutorial && (
        <TutorialVideo
          onEnded={() => {
            setShowTutorial(false);
            // Now reveal the game UI
            startGameUI();
          }}
        />
      )}

      {/* Black screen overlay (4 seconds) */}
      {showBlackScreen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "black",
            zIndex: 9999,
          }}
        >
          <style>{`
            @keyframes blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
          `}</style>
          <div
            style={{
              position: "absolute",
              bottom: "40px",
              left: "40px",
              color: "white",
              fontFamily: "monospace",
              fontSize: "18px",
              animation: "blink 1.5s ease-in-out infinite",
            }}
          >
            loading...
          </div>
        </div>
      )}

      {/* Tutorial video after black screen */}
      {showTutorialVideo && (
        <TutorialVideo
          onEnded={() => {
            setShowTutorialVideo(false);
            // Now reveal the game UI
            startGameUI();
          }}
        />
      )}
    </div>
  );
}

export default MainMenu;
