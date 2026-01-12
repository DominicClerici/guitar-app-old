import React, { useEffect, useState } from "react"

interface AnimatedUnmountProps {
  children: React.ReactNode
  className?: string
  animClassIn: string
  animClassOut: string
  display: boolean
}

export default function AnimatedUnmount({
  children,
  className = "",
  animClassIn,
  animClassOut,
  display,
}: AnimatedUnmountProps) {
  const [shouldRender, setShouldRender] = useState(display)

  useEffect(() => {
    if (display) {
      setShouldRender(true)
    }
  }, [display])

  const handleAnimationEnd = () => {
    if (!display) {
      setShouldRender(false)
    }
  }

  return (
    <div
      className={`${className} ${display ? animClassIn : animClassOut}`.trim()}
      onAnimationEnd={handleAnimationEnd}
    >
      {shouldRender && children}
    </div>
  )
}
