import React from 'react'

const ProfileIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Head outline - smooth inverted U shape, profile facing left */}
      <path
        d="M 80 20 Q 80 10, 50 10 Q 20 10, 20 25 Q 20 35, 25 50 Q 30 65, 35 75"
        stroke="#000000"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Glasses - horizontal line extending from left side with vertical line */}
      <line
        x1="10"
        y1="35"
        x2="45"
        y2="35"
        stroke="#000000"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="10"
        y1="35"
        x2="10"
        y2="45"
        stroke="#000000"
        strokeWidth="3"
        strokeLinecap="round"
      />
      
      {/* Eye - small tight spiral/swirl within glasses */}
      <path
        d="M 20 37 Q 22 35, 24 37 Q 22 39, 20 37"
        stroke="#000000"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Nose - prominent elongated hooked nose */}
      <path
        d="M 45 35 Q 48 42, 46 50 Q 44 55, 42 53"
        stroke="#000000"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Bow tie - two triangular shapes pointing outward from central dot */}
      <circle
        cx="42"
        cy="58"
        r="1.5"
        fill="#000000"
      />
      <path
        d="M 42 58 L 38 53 L 38 63 Z"
        fill="#000000"
      />
      <path
        d="M 42 58 L 46 53 L 46 63 Z"
        fill="#000000"
      />
      <line
        x1="42"
        y1="59.5"
        x2="42"
        y2="68"
        stroke="#000000"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      
      {/* Collar/Torso - jagged angular line suggesting collar/lapel */}
      <path
        d="M 40 68 L 37 71 L 39 73 L 37 75 L 42 78 Q 50 80, 60 78"
        stroke="#000000"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default ProfileIcon

