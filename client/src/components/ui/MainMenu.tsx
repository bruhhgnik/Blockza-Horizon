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
    resetRace,
    initializeRace,
    startRaceCountdown,
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

  // ALL-IN-ONE: Handle everything automatically without requiring multiple clicks
  try {
    // Step 1: Connect wallet if not connected
    if (!isConnected) {
      console.log('🔌 Connecting wallet...');
      await handleConnect();
      await new Promise((r) => setTimeout(r, 1500));
      await refetch();

      // CRITICAL: Verify wallet is actually connected before proceeding
      const currentStatus = useAppStore.getState().connectionStatus;
      if (currentStatus !== 'connected') {
        console.error('❌ Wallet connection failed');
        alert('Please connect your wallet to play');
        return; // STOP - don't start game
      }
      console.log('✅ Wallet connected');
    }

    // Step 2: Initialize player if needed
    if (!hasPlayerStats && canInitialize) {
      console.log('🎮 Initializing player...');
      const res = await initializePlayer();
      if (!res?.success) {
        console.error('❌ Player initialization failed');
        alert('Failed to initialize player. Please try again.');
        return; // STOP - don't start game
      }
      await new Promise((r) => setTimeout(r, 2000));
      await refetch();
      console.log('✅ Player initialized');
    }

    // FINAL VERIFICATION: Ensure we have all requirements before starting game
    await refetch(); // One final refetch to get latest state
    const finalState = useAppStore.getState();

    if (!finalState.playerStats) {
      console.error('❌ Missing player stats - cannot start game');
      alert('Player data not found. Please try again.');
      return; // STOP
    }

    console.log('✅ All requirements met, starting game...');

    // Step 3: Enter the game (with session cleanup if needed)
    stopBgmWithFade(700);

    // If a previous session is still active, end it first
    if (gameAlreadyActive && canEndGame) {
      console.log('🛑 Ending previous game session...');
      try {
        await endGame();
        console.log('✅ End game transaction submitted');
      } catch (err) {
        console.error('⚠️ Failed to end game:', err);
      }

      // HARD REFRESH OF FRONTEND STATE - wait longer for blockchain to update
      console.log('🔄 Polling for session to end...');
      try {
        await pollRefetchUntilInactive(refetch, 20, 500); // Increased to 20 tries, 500ms each = 10 seconds
        console.log('✅ Session confirmed ended');
      } catch (err) {
        console.error('⚠️ Session polling timeout, continuing anyway');
      }

      // Extra wait to ensure blockchain state is fully updated
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Start a fresh session if allowed
    if (canStartGame) {
      try {
        console.log('🎲 Starting new game session...');
        await startGame();
        // One extra refetch burst
        await refetch();
        await new Promise((r) => setTimeout(r, 250));
        await refetch();
        console.log('✅ Game session started');
      } catch (err) {
        console.error('❌ Failed to start game session:', err);
        alert('Failed to start game session. Please try again.');
        return; // STOP
      }
    }

    // Reset and initialize a fresh race (clear old session completely)
    console.log('🔄 Resetting race state for new session');
    resetRace();
    initializeRace();

    // Start tutorial sequence: black screen -> video -> game
    setShowBlackScreen(true);
  } catch (error) {
    console.error('❌ Critical error in play flow:', error);
    alert(`Failed to start game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // DO NOT START GAME ON ERROR
    return;
  }
};



    

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
      }}
    >
      {/* Video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      >
        <source src="/menu.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay for better button visibility */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* Centered content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* PLAY FOR FREE button - centered and enlarged */}
        <button
          onClick={handlePlayForFree}
          disabled={isLoading}
          style={{
            all: "unset",
            cursor: isLoading ? "not-allowed" : "pointer",
            transform: "scale(1)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.transform = "scale(1.05)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <div
            style={{
              background: "linear-gradient(to bottom, #ffffff, #f0f0f0)",
              color: "#000000",
              borderRadius: "16px",
              padding: "32px 80px",
              fontSize: "48px",
              fontWeight: 900,
              letterSpacing: "4px",
              textTransform: "uppercase",
              boxShadow: "0 8px 0 rgba(0,0,0,0.3), 0 12px 40px rgba(0,0,0,0.5)",
              border: "4px solid #ffd700",
              opacity: isLoading ? 0.7 : 1,
              fontFamily: '"Impact", "Arial Black", sans-serif',
              textAlign: "center",
            }}
          >
            {isLoading ? "LOADING..." : "PLAY FOR FREE"}
          </div>
        </button>
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
