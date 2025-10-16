import React, { useEffect, useState } from 'react';
import useAppStore from '../../zustand/store';
import { useStarknetConnect } from '../../dojo/hooks/useStarknetConnect';

export const RacingHUD: React.FC = () => {
  const { carPositions, raceStarted, velocity, position, rotation } = useAppStore();
  const { address } = useStarknetConnect();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [speed, setSpeed] = useState(0);

  // Find player's car
  const playerCar = carPositions.find(car => car.id === 'player');

  // Calculate player's position
  const finishedCars = carPositions.filter(car => car.finishTime !== null);
  const sortedCars = [...carPositions].sort((a, b) => {
    if (a.finishTime !== null && b.finishTime !== null) {
      return a.finishTime - b.finishTime;
    }
    if (a.finishTime !== null) return -1;
    if (b.finishTime !== null) return 1;
    return 0;
  });

  const playerPosition = playerCar ? sortedCars.findIndex(car => car.id === 'player') + 1 : 0;
  const totalCars = carPositions.length;

  // Timer for elapsed time
  useEffect(() => {
    if (!raceStarted) {
      setElapsedTime(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [raceStarted]);

  // Calculate speed from velocity
  useEffect(() => {
    if (velocity && raceStarted) {
      // Calculate speed from velocity vector (x, z components)
      const speedValue = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
      // Convert to km/h: maxSpeed (1.2) should equal ~180 km/h
      // So multiplier is 180 / 1.2 = 150
      const kmh = Math.floor(speedValue * 150);
      setSpeed(kmh);
    } else {
      setSpeed(0);
    }
  }, [velocity, raceStarted]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const formatAddress = (addr: string) => {
    if (!addr) return 'Not Connected';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getPositionSuffix = (pos: number) => {
    if (pos === 1) return 'ST';
    if (pos === 2) return 'ND';
    if (pos === 3) return 'RD';
    return 'TH';
  };

  // Convert rotation to compass direction
  const getCompassDirection = (radians: number) => {
    const degrees = ((radians * 180 / Math.PI) % 360 + 360) % 360;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  };

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
      {/* Top bar - Wallet and Time */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%)',
          padding: '20px 30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Wallet Address */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            border: '2px solid rgba(255, 215, 0, 0.5)',
            borderRadius: '8px',
            padding: '10px 20px',
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#ffd700',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          {formatAddress(address || '')}
        </div>

        {/* Time Elapsed */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            border: '2px solid rgba(0, 255, 0, 0.5)',
            borderRadius: '8px',
            padding: '10px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Time
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00ff00', fontFamily: 'monospace' }}>
            {formatTime(elapsedTime)}
          </div>
        </div>

        {/* Coordinates */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            border: '2px solid rgba(0, 191, 255, 0.5)',
            borderRadius: '8px',
            padding: '10px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '5px' }}>
            Coordinates
          </div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#00bfff', fontFamily: 'monospace' }}>
            X: {position.x.toFixed(1)}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#00bfff', fontFamily: 'monospace' }}>
            Y: {position.y.toFixed(1)}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#00bfff', fontFamily: 'monospace' }}>
            Z: {position.z.toFixed(1)}
          </div>
          {/* Compass */}
          <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255, 170, 0, 0.3)', paddingTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '5px' }}>
              Direction
            </div>
            {/* Compass Circle */}
            <div style={{ position: 'relative', width: '60px', height: '60px' }}>
              {/* Compass background */}
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0, 0, 0, 0.8) 0%, rgba(50, 50, 50, 0.8) 100%)',
                border: '2px solid rgba(255, 170, 0, 0.5)',
              }} />
              {/* Cardinal directions */}
              <div style={{ position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', fontWeight: 'bold', color: '#ff4444' }}>N</div>
              <div style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>S</div>
              <div style={{ position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>E</div>
              <div style={{ position: 'absolute', left: '2px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>W</div>
              {/* Compass needle */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '3px',
                height: '20px',
                background: 'linear-gradient(to bottom, #ff4444 0%, #ffaa00 100%)',
                transformOrigin: 'center bottom',
                transform: `translate(-50%, -100%) rotate(${rotation * 180 / Math.PI}deg)`,
                boxShadow: '0 0 5px rgba(255, 68, 68, 0.8)',
              }}>
                {/* Needle point */}
                <div style={{
                  position: 'absolute',
                  top: '-4px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderBottom: '6px solid #ff4444',
                }} />
              </div>
              {/* Center dot */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#ffaa00',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 4px rgba(255, 170, 0, 0.8)',
              }} />
            </div>
            {/* Direction label */}
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffaa00', fontFamily: 'monospace', marginTop: '5px' }}>
              {getCompassDirection(rotation)}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom left - Position and Laps */}
      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          left: '30px',
          display: 'flex',
          gap: '20px',
          alignItems: 'flex-end',
        }}
      >
        {/* Position */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.9) 0%, rgba(255, 165, 0, 0.9) 100%)',
            border: '4px solid rgba(0, 0, 0, 0.8)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.8)',
          }}
        >
          <div style={{ fontSize: '14px', color: '#000', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Position
          </div>
          <div style={{ fontSize: '72px', fontWeight: 900, color: '#000', lineHeight: 1, fontFamily: '"Impact", "Arial Black", sans-serif' }}>
            {playerPosition}
            <sup style={{ fontSize: '32px', verticalAlign: 'super' }}>{getPositionSuffix(playerPosition)}</sup>
          </div>
          <div style={{ fontSize: '18px', color: '#000', fontWeight: 'bold' }}>
            / {totalCars}
          </div>
        </div>

        {/* Laps */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.9)',
            border: '3px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '12px',
            padding: '15px 25px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Laps
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffffff', fontFamily: 'monospace' }}>
            0 / 1
          </div>
        </div>
      </div>

      {/* Bottom right - Speed Display */}
      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          right: '30px',
          background: 'rgba(0, 0, 0, 0.9)',
          border: '3px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '12px',
          padding: '20px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: '180px',
        }}
      >
        <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>
          Speed
        </div>
        <div style={{ fontSize: '72px', fontWeight: 'bold', color: '#00ff00', fontFamily: 'monospace', lineHeight: 1 }}>
          {speed}
        </div>
        <div style={{ fontSize: '18px', color: '#888', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '10px' }}>
          KM/H
        </div>
      </div>
    </div>
  );
};
