import React from "react"
import Svg, { Path } from "react-native-svg"

type LogoProps = {
  size?: number
}

export default function Logo({ size = 150 }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" fill="none">
      <Path
        d="M120 20 C75 20, 40 45, 40 75 C40 120, 70 160, 120 220 C170 160, 200 120, 200 75 C200 45, 165 20, 120 20 Z"
        fill="white"
      />
      <Path
        d="M70 75 Q95 55, 120 75 T170 75"
        stroke="#5B4FE8"
        strokeWidth={8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M70 100 Q95 80, 120 100 T170 100"
        stroke="#5B4FE8"
        strokeWidth={8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M70 125 Q95 105, 120 125 T170 125"
        stroke="#5B4FE8"
        strokeWidth={8}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  )
}
