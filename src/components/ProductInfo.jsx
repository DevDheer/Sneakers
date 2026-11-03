import { useRef, useState, useImperativeHandle, forwardRef } from 'react'
import gsap from 'gsap'

/**
 * ProductInfo — Two-Phase Cinematic Hidden-Line Text Reveal.
 *
 * Architecture:
 *   - Outer wrappers: overflow-hidden horizontal clipping boundary (never animated).
 *   - Inner text elements: animated using GSAP translateY transforms.
 *
 * Two-Phase Direction:
 *   - Phase 1 (Outgoing): translateY(0) → translateY(110%) [moves DOWNWARDS below clip line, fades out]
 *   - Content Swap: updates product details while completely hidden below clip line
 *   - Phase 2 (Incoming): translateY(110%) → translateY(0) [emerges UPWARDS into baseline, fades in]
 */
const ProductInfo = forwardRef(function ProductInfo(
  { shoe: initialShoe },
  ref
) {
  const [displayedShoe, setDisplayedShoe] = useState(initialShoe)
  const currentShoeIdRef = useRef(initialShoe?.id)
  const queuedShoeRef = useRef(null)
  const isAnimatingRef = useRef(false)

  const titleRef = useRef(null)
  const descRef = useRef(null)

  const getTargets = () => [titleRef.current, descRef.current].filter(Boolean)

  const runTransition = (newShoe) => {
    if (!newShoe || newShoe.id === currentShoeIdRef.current) return
    currentShoeIdRef.current = newShoe.id
    queuedShoeRef.current = newShoe

    const els = getTargets()
    gsap.killTweensOf(els)
    isAnimatingRef.current = true

    // ── PHASE 1: OUTGOING TEXT ──
    // Moves DOWNWARDS behind the invisible clipping line: translateY(0) → translateY(110%)
    gsap.to(els, {
      yPercent: 110,
      opacity: 0,
      duration: 0.22,
      stagger: 0.02,
      ease: 'power3.in',
      onComplete: () => {
        // Old text is now completely hidden behind the clipping boundary!
        const shoeToDisplay = queuedShoeRef.current || newShoe
        setDisplayedShoe(shoeToDisplay)

        // Set incoming elements below the clipping line
        gsap.set(els, { yPercent: 110, opacity: 0 })

        // ── PHASE 2: INCOMING TEXT ──
        // Animates UPWARDS from below the clipping line into original baseline: translateY(110%) → translateY(0)
        gsap.to(els, {
          yPercent: 0,
          opacity: 1,
          duration: 0.38,
          stagger: 0.04,
          ease: 'power3.out',
          onComplete: () => {
            isAnimatingRef.current = false
            // Check if another shoe arrived during the animation
            if (queuedShoeRef.current && queuedShoeRef.current.id !== shoeToDisplay.id) {
              runTransition(queuedShoeRef.current)
            }
          },
        })
      },
    })
  }

  useImperativeHandle(ref, () => ({
    transitionTo(newShoe) {
      if (!newShoe) return
      queuedShoeRef.current = newShoe
      if (isAnimatingRef.current) return
      runTransition(newShoe)
    },
    // Animate text downward into clipping boundary (Exit)
    animateTextOut() {
      const els = getTargets()
      gsap.killTweensOf(els)
      return gsap.to(els, {
        yPercent: 110,
        opacity: 0,
        duration: 0.28,
        stagger: 0.03,
        ease: 'power3.in',
      })
    },
    // Position text below clipping boundary prior to entrance
    prepareTextEntrance(shoe) {
      if (shoe) {
        currentShoeIdRef.current = shoe.id
        setDisplayedShoe(shoe)
      }
      const els = getTargets()
      gsap.killTweensOf(els)
      gsap.set(els, { yPercent: 110, opacity: 0 })
    },
    // Animate text upward from clipping boundary into position (Entrance)
    animateTextIn(duration = 0.55) {
      const els = getTargets()
      gsap.killTweensOf(els)
      return gsap.to(els, {
        yPercent: 0,
        opacity: 1,
        duration,
        stagger: 0.04,
        ease: 'power3.out',
      })
    },
  }))

  return (
    <div className="flex flex-col z-30 max-w-sm select-none pointer-events-auto">
      {/* ── Heading: Invisible Horizontal Clipping Wrapper ── */}
      <div className="overflow-hidden min-h-[66px] sm:min-h-[76px] lg:min-h-[82px] flex items-center">
        <h1
          ref={titleRef}
          className="text-5xl sm:text-6xl lg:text-[72px] font-medium tracking-[-0.035em] text-neutral-900 leading-[0.92] m-0 p-0 will-change-transform"
        >
          {displayedShoe.name}
        </h1>
      </div>

      {/* ── Description: Invisible Horizontal Clipping Wrapper ── */}
      <div className="overflow-hidden pt-3.5 min-h-[58px] flex items-start">
        <p
          ref={descRef}
          className="text-[14.5px] leading-relaxed text-neutral-600 max-w-[320px] font-normal will-change-transform m-0"
        >
          {displayedShoe.description}
        </p>
      </div>
    </div>
  )
})

export default ProductInfo
