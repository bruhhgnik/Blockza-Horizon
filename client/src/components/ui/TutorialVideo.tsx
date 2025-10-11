import React, { useEffect } from 'react';

interface TutorialVideoProps {
  onEnded: () => void;
}

export const TutorialVideo: React.FC<TutorialVideoProps> = ({ onEnded }) => {
  useEffect(() => {
    // Auto-end tutorial after a short delay (or when video ends)
    const timer = setTimeout(() => {
      onEnded();
    }, 100); // Immediate transition for racing game

    return () => clearTimeout(timer);
  }, [onEnded]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'black',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '24px', marginBottom: '16px' }}>Get Ready to Race!</p>
        <p style={{ fontSize: '16px', opacity: 0.7 }}>
          Use WASD or Arrow Keys to control your car
        </p>
      </div>
    </div>
  );
};
