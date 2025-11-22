import React from 'react'

const FruitIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Fruit body - light gray circle */}
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="#D3D3D3"
        stroke="#000000"
        strokeWidth="2"
      />
      
      {/* Leaf - light green with bite */}
      <path
        d="M 30 20 Q 35 15, 40 20 Q 45 18, 50 20 Q 45 25, 40 22 Q 35 25, 30 20"
        fill="#90EE90"
        stroke="#000000"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Bite mark on leaf */}
      <path
        d="M 32 18 Q 34 16, 36 18"
        fill="none"
        stroke="#000000"
        strokeWidth="1.5"
      />
      
      {/* Eyes - two black dots */}
      <circle cx="42" cy="48" r="3" fill="#000000" />
      <circle cx="58" cy="48" r="3" fill="#000000" />
      
      {/* Eyebrows - curved lines */}
      <path
        d="M 38 40 Q 40 35, 42 40"
        stroke="#000000"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 58 40 Q 60 35, 62 40"
        stroke="#000000"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Nose/Mouth - L-shaped line */}
      <path
        d="M 50 52 L 50 58 L 45 58"
        stroke="#000000"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default FruitIcon

