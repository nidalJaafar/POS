'use client'

import { useEffect, useRef } from 'react'

export default function useHorizontalScroll() {
  const elRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = elRef.current
    if (el) {
      const onWheel = (e: WheelEvent) => {
        if (e.deltaY === 0 && e.deltaX === 0) return
        e.preventDefault()
        el.scrollTo({
          left: el.scrollLeft + (e.deltaY !== 0 ? e.deltaY : e.deltaX) * 5,
          behavior: 'smooth',
        })
      }
      el.addEventListener('wheel', onWheel)
      return () => el.removeEventListener('wheel', onWheel)
    }
  }, [])
  return elRef
}
