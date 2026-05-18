'use client';
import { useEffect, useState } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_KEY = 'visualis_tour_seen';

const STEPS = [
  {
    element: '.panel-board',
    popover: {
      title: 'The frozen board',
      description: "The board never moves. Every line lives only in your head — that's the training.",
      side: 'right' as const,
    },
  },
  {
    element: '.board-mat',
    popover: {
      title: 'Click to record a move',
      description: 'Click a source square, then a destination square. The pieces stay put.',
      side: 'right' as const,
    },
  },
  {
    element: '.panel-analysis',
    popover: {
      title: 'Your move tree',
      description: 'Every move you record appears here. You can build branching lines.',
      side: 'left' as const,
    },
  },
  {
    element: '.move-token.fixed',
    popover: {
      title: 'Setup move',
      description: 'This shows the last move played before the puzzle — your starting context.',
      side: 'bottom' as const,
    },
  },
  {
    element: '.legend',
    popover: {
      title: 'Colour coding',
      description: 'Blue = your moves · Red = opponent · Yellow glow = your active cursor.',
      side: 'top' as const,
    },
  },
  {
    element: '.kb-hints',
    popover: {
      title: 'Keyboard navigation',
      description: '← → walk depth · ↑ ↓ switch branches · click any token to jump directly.',
      side: 'top' as const,
    },
  },
  {
    element: '.actions',
    popover: {
      title: 'Undo & Reset',
      description: 'Undo removes your last recorded move. Reset clears the whole tree.',
      side: 'top' as const,
    },
  },
  {
    element: '.btn-primary',
    popover: {
      title: 'Submit & check',
      description: 'When your tree is complete, Submit runs Stockfish evaluation on every move.',
      side: 'top' as const,
    },
  },
];

export default function TourGuide() {
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      setShowPopup(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(TOUR_KEY, '1');
    setShowPopup(false);
  }

  function startTour() {
    dismiss();
    const driverInstance = driver({
      showProgress: true,
      steps: STEPS,
      onDestroyStarted: () => driverInstance.destroy(),
    });
    setTimeout(() => driverInstance.drive(), 300);
  }

  if (!showPopup) return null;

  return (
    <div
      className="tour-scrim"
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         10000,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(30, 24, 18, 0.52)',
        backdropFilter: 'blur(3px)',
        animation:      'tour-fade-in 200ms ease',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        style={{
          background:   'var(--paper)',
          border:       '1px solid rgba(31,29,26,.18)',
          borderRadius: '8px',
          padding:      '28px 32px',
          maxWidth:     '420px',
          width:        '90vw',
          boxShadow:    '0 8px 32px rgba(30, 24, 18, 0.22)',
        }}
      >
        <h2
          id="tour-title"
          style={{
            fontFamily: 'var(--serif)',
            fontSize:   '20px',
            fontWeight: 600,
            color:      'var(--ink)',
            margin:     '0 0 12px',
          }}
        >
          Welcome to Visualis
        </h2>
        <p
          style={{
            fontFamily: 'var(--sans)',
            fontSize:   '14px',
            lineHeight: 1.65,
            color:      'var(--ink-soft)',
            margin:     '0 0 24px',
          }}
        >
          This trainer works differently — the board never moves.
          You map out lines entirely in your head, then let the engine judge them.
          Want a quick 60-second tour?
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={dismiss}>Skip</button>
          <button className="btn-primary" onClick={startTour}>Take the tour →</button>
        </div>
      </div>
    </div>
  );
}
