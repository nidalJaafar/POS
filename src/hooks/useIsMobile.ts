'use client'
import { useEffect, useState } from 'react'

export default function useIsMobile(threshold = 650) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < threshold)
    const handleResize = () => setIsMobile(window.innerWidth < threshold)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [threshold])

  return isMobile
}
