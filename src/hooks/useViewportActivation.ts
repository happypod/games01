import { useEffect, useRef, useState } from 'react'

export function useViewportActivation<T extends HTMLElement>() {
  const targetRef = useRef<T>(null)
  const [isActive, setIsActive] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )

  useEffect(() => {
    if (isActive) return
    const target = targetRef.current
    if (target === null) return

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      setIsActive(true)
      observer.disconnect()
    }, { threshold: 0.01 })

    observer.observe(target)
    return () => observer.disconnect()
  }, [isActive])

  return { targetRef, isActive } as const
}
