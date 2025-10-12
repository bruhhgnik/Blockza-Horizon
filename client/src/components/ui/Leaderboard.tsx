import React, { useMemo } from 'react';
import useAppStore from '../../zustand/store';

export const Leaderboard: React.FC = () => {
  const { carPositions, raceStarted, raceFinished, resetRace, initializeRace, startRaceCountdown } = useAppStore();

  // Sort cars by finish time (finished cars first, then by time)
  const sortedCars = useMemo(() => {
    return [...carPositions].sort((a, b) => {
      // Both finished - sort by time
      if (a.finishTime !== null && b.finishTime !== null) {
        return a.finishTime - b.finishTime;
      }
      // Only a finished
      if (a.finishTime !== null) return -1;
      // Only b finished
      if (b.finishTime !== null) return 1;
      // Neither finished - maintain order
      return 0;
    });
  }, [carPositions]);

  // Only show leaderboard when race is finished (player completed lap)
  if (!raceStarted || !raceFinished) return null;

  // Find player's finish time and position
  const playerCar = carPositions.find(car => car.id === 'player');
  const finishedCars = carPositions.filter(car => car.finishTime !== null);
  const playerPosition = playerCar?.finishTime
    ? finishedCars.findIndex(car => car.id === 'player') + 1
    : null;

  const handleNewGame = () => {
    console.log('🔄 Starting new game...');
    resetRace();
    initializeRace();
    setTimeout(() => {
      startRaceCountdown();
    }, 500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(10, 10, 20, 0.98) 100%)',
        border: '4px solid rgba(255, 215, 0, 0.8)',
        borderRadius: '0',
        padding: '0',
        width: '600px',
        maxWidth: '90vw',
        zIndex: 999,
        color: 'white',
        fontFamily: '"Pricedown", "Impact", "Arial Black", sans-serif',
        boxShadow: '0 0 60px rgba(255, 215, 0, 0.4), inset 0 0 100px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
      }}
    >
      {/* Scan lines effect */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.03) 2px, rgba(255, 255, 255, 0.03) 4px)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Top bar */}
      <div
        style={{
          background: 'linear-gradient(to right, rgba(255, 215, 0, 0.9), rgba(255, 165, 0, 0.9))',
          padding: '15px 30px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '42px',
            fontWeight: 900,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: '#000000',
            textShadow: '2px 2px 0px rgba(0, 0, 0, 0.3)',
            textAlign: 'center',
          }}
        >
          RACE COMPLETE
        </h2>
      </div>

      {/* Player stats section */}
      {playerCar?.finishTime && (
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            padding: '25px 30px',
            borderBottom: '2px solid rgba(255, 215, 0, 0.3)',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: '#999', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '5px' }}>
                Your Time
              </div>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#00ff00', textShadow: '0 0 20px rgba(0, 255, 0, 0.5)' }}>
                {(playerCar.finishTime / 1000).toFixed(2)}s
              </div>
            </div>
            {playerPosition && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: '#999', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '5px' }}>
                  Position
                </div>
                <div style={{
                  fontSize: '64px',
                  fontWeight: 'bold',
                  color: playerPosition === 1 ? '#ffd700' : playerPosition === 2 ? '#c0c0c0' : playerPosition === 3 ? '#cd7f32' : '#ffffff',
                  textShadow: `0 0 20px ${playerPosition === 1 ? 'rgba(255, 215, 0, 0.8)' : 'rgba(255, 255, 255, 0.3)'}`,
                  lineHeight: 1,
                }}>
                  #{playerPosition}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard section */}
      <div style={{ padding: '20px 30px', position: 'relative', zIndex: 2 }}>
        <div style={{
          fontSize: '16px',
          color: '#ffd700',
          textTransform: 'uppercase',
          letterSpacing: '3px',
          marginBottom: '15px',
          fontWeight: 'bold',
          borderBottom: '2px solid rgba(255, 215, 0, 0.3)',
          paddingBottom: '10px',
        }}>
          FINAL STANDINGS
        </div>
        {sortedCars.map((car, index) => {
          const isFinished = car.finishTime !== null;
          const position = isFinished
            ? sortedCars.filter((c) => c.finishTime !== null).indexOf(car) + 1
            : null;

          return (
            <div
              key={car.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '15px 20px',
                marginBottom: '8px',
                background:
                  position === 1
                    ? 'linear-gradient(90deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.1) 100%)'
                    : position === 2
                    ? 'linear-gradient(90deg, rgba(192, 192, 192, 0.3) 0%, rgba(192, 192, 192, 0.1) 100%)'
                    : position === 3
                    ? 'linear-gradient(90deg, rgba(205, 127, 50, 0.3) 0%, rgba(205, 127, 50, 0.1) 100%)'
                    : 'linear-gradient(90deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                borderLeft: car.id === 'player' ? '4px solid #00ff00' : 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                {isFinished && (
                  <span
                    style={{
                      fontSize: '32px',
                      fontWeight: 900,
                      minWidth: '50px',
                      color:
                        position === 1
                          ? '#ffd700'
                          : position === 2
                          ? '#c0c0c0'
                          : position === 3
                          ? '#cd7f32'
                          : '#666666',
                      textShadow: position && position <= 3 ? '0 0 10px currentColor' : 'none',
                    }}
                  >
                    {position}
                  </span>
                )}
                {!isFinished && (
                  <span
                    style={{
                      fontSize: '32px',
                      minWidth: '50px',
                      color: '#333333',
                      fontWeight: 900,
                    }}
                  >
                    -
                  </span>
                )}
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: car.id === 'player' ? 900 : 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: car.id === 'player' ? '#00ff00' : '#ffffff',
                  }}
                >
                  {car.name}
                </span>
              </div>

              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: isFinished ? '#ffffff' : '#555555',
                  fontFamily: 'monospace',
                }}
              >
                {isFinished
                  ? `${(car.finishTime! / 1000).toFixed(2)}s`
                  : 'DNF'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom button section */}
      <div style={{ padding: '20px 30px', background: 'rgba(0, 0, 0, 0.8)', position: 'relative', zIndex: 2 }}>
        <button
          onClick={handleNewGame}
          style={{
            width: '100%',
            padding: '18px',
            fontSize: '24px',
            fontWeight: 900,
            color: '#000000',
            background: 'linear-gradient(to bottom, #ffd700, #ffa500)',
            border: 'none',
            borderRadius: '0',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '3px',
            transition: 'all 0.2s ease',
            boxShadow: '0 6px 0px #885500, 0 8px 20px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(2px)';
            e.currentTarget.style.boxShadow = '0 4px 0px #885500, 0 6px 15px rgba(0, 0, 0, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 6px 0px #885500, 0 8px 20px rgba(0, 0, 0, 0.5)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateY(4px)';
            e.currentTarget.style.boxShadow = '0 2px 0px #885500, 0 4px 10px rgba(0, 0, 0, 0.5)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(2px)';
            e.currentTarget.style.boxShadow = '0 4px 0px #885500, 0 6px 15px rgba(0, 0, 0, 0.5)';
          }}
        >
          ▶ NEW RACE
        </button>
      </div>
    </div>
  );
};
