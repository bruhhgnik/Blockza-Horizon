import React, { useMemo } from 'react';
import useAppStore from '../../zustand/store';

export const Leaderboard: React.FC = () => {
  const { carPositions, raceStarted } = useAppStore();

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

  // Check if any car has finished
  const anyCarFinished = carPositions.some((car) => car.finishTime !== null);

  // Don't show leaderboard if race hasn't started or no car has finished yet
  if (!raceStarted || !anyCarFinished) return null;

  // Check if all cars finished
  const allCarsFinished = carPositions.every((car) => car.finishTime !== null);

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.9)',
        border: '3px solid #ffd700',
        borderRadius: '15px',
        padding: '30px',
        minWidth: '400px',
        zIndex: 999,
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        boxShadow: '0 0 30px rgba(255, 215, 0, 0.5)',
      }}
    >
      <h2
        style={{
          textAlign: 'center',
          fontSize: '32px',
          marginBottom: '20px',
          color: '#ffd700',
          textShadow: '0 0 10px rgba(255, 215, 0, 0.8)',
        }}
      >
        {allCarsFinished ? 'RACE COMPLETE!' : 'LEADERBOARD'}
      </h2>

      <div style={{ marginTop: '20px' }}>
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
                padding: '12px 15px',
                marginBottom: '10px',
                background:
                  position === 1
                    ? 'rgba(255, 215, 0, 0.2)'
                    : position === 2
                    ? 'rgba(192, 192, 192, 0.2)'
                    : position === 3
                    ? 'rgba(205, 127, 50, 0.2)'
                    : 'rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                border: car.id === 'player' ? '2px solid #00ff00' : '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {isFinished && (
                  <span
                    style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      minWidth: '30px',
                      color:
                        position === 1
                          ? '#ffd700'
                          : position === 2
                          ? '#c0c0c0'
                          : position === 3
                          ? '#cd7f32'
                          : '#ffffff',
                    }}
                  >
                    {position}.
                  </span>
                )}
                {!isFinished && (
                  <span
                    style={{
                      fontSize: '18px',
                      minWidth: '30px',
                      color: '#888888',
                    }}
                  >
                    -
                  </span>
                )}
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: car.id === 'player' ? 'bold' : 'normal',
                  }}
                >
                  {car.name}
                </span>
              </div>

              <span
                style={{
                  fontSize: '16px',
                  color: isFinished ? '#00ff00' : '#888888',
                }}
              >
                {isFinished
                  ? `${(car.finishTime! / 1000).toFixed(2)}s`
                  : 'Racing...'}
              </span>
            </div>
          );
        })}
      </div>

      {allCarsFinished && (
        <div
          style={{
            marginTop: '25px',
            textAlign: 'center',
            fontSize: '14px',
            color: '#888888',
          }}
        >
          Press ESC to return to menu
        </div>
      )}
    </div>
  );
};
