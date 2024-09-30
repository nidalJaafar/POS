'use client'

import { useEffect, useState } from 'react'

export default function useIsMobile(threshold = 650) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < threshold
  )

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < threshold)

    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [threshold])

  return isMobile
}
