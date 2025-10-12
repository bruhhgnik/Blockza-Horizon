import { Canvas } from "@react-three/fiber";
import { TransactionPopup } from "../components/ui/TransactionPopup";
import { usePlayerMovement } from "../dojo/hooks/usePlayerMovement";
import useAppStore from "../zustand/store";
import { MainMenu } from "../components/ui/MainMenu";
import { RacingGame } from "../components/game/RacingGame";
import { RacingHUD } from "../components/ui/RacingHUD";
import { CountdownOverlay } from "../components/ui/CountdownOverlay";
import { Leaderboard } from "../components/ui/Leaderboard";

const App = () => {
  const { gameStarted } = useAppStore();

  // Track onchain movement
  const {
    showTransactionPopup,
    transactionError,
    isProcessingTransaction,
    closeTransactionPopup,
  } = usePlayerMovement();

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* Show main menu if game hasn't started */}
      {!gameStarted && <MainMenu />}

      {/* Racing HUD - Speedometer, Position, Time, etc. */}
      {gameStarted && <RacingHUD />}

      {/* Countdown overlay */}
      {gameStarted && <CountdownOverlay />}

      {/* Leaderboard */}
      {gameStarted && <Leaderboard />}

      {/* 3D Canvas - Racing Game */}
      {gameStarted && (
        <Canvas
          camera={{ position: [0, 15, 20], fov: 75 }}
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(to bottom, #1a1a2e 0%, #0f0f1e 100%)",
          }}
        >
          <RacingGame />
        </Canvas>
      )}

      {/* Transaction popup for onchain movements */}
      <TransactionPopup
        isVisible={showTransactionPopup}
        isLoading={isProcessingTransaction}
        error={transactionError}
        onClose={closeTransactionPopup}
      />
    </div>
  );
};

export default App;
