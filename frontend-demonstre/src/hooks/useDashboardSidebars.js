import { useState } from 'react'

const DESKTOP_BREAKPOINT = 1024

const useDashboardSidebars = () => {
  const [isLeftOpen, setIsLeftOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= DESKTOP_BREAKPOINT
    }
    return true
  })
  const [isRightOpen, setIsRightOpen] = useState(false)

  const handleToggleLeft = (open) => {
    setIsLeftOpen(open)
    if (open && window.innerWidth < DESKTOP_BREAKPOINT) {
      setIsRightOpen(false)
    }
  }

  const handleToggleRight = (open) => {
    setIsRightOpen(open)
    if (open && window.innerWidth < DESKTOP_BREAKPOINT) {
      setIsLeftOpen(false)
    }
  }

  const closeSidebars = () => {
    setIsLeftOpen(false)
    setIsRightOpen(false)
  }

  return {
    isLeftOpen,
    isRightOpen,
    handleToggleLeft,
    handleToggleRight,
    closeSidebars,
  }
}

export default useDashboardSidebars