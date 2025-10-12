import React from 'react';
import useAppStore from '../../zustand/store';

export const CountdownOverlay: React.FC = () => {
  const { countdownValue } = useAppStore();

  // Don't show anything if countdown is done
  if (countdownValue === null) return null;

  const displayText = countdownValue === 0 ? 'GO!' : countdownValue.toString();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          fontSize: '150px',
          fontWeight: 'bold',
          color: countdownValue === 0 ? '#00ff00' : '#ffffff',
          textShadow: '0 0 20px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 0, 0, 0.6)',
          animation: 'countdownPulse 0.5s ease-out',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {displayText}
      </div>
      <style>{`
        @keyframes countdownPulse {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
