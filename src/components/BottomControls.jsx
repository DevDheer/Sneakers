import { LayoutGrid } from 'lucide-react'
import { useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react'
import gsap from 'gsap'

/**
 * BottomControls — Bottom navigation bar with price reveal and control pop transitions.
 *
 * Grid View toggle button features:
 *   - Magnetic hover: button follows cursor subtly within its hitbox.
 *   - Icon animation: icon rotates and scales on hover, snaps back with elastic ease.
 *   - Dot pulse: a small dot pulses next to the label on hover.
 */
const BottomControls = forwardRef(function BottomControls(
  { currentShoe, onOpenGridView, activeThumbnail, onSelectThumbnail, isGridMode = false },
  ref
) {
  const [displayedShoe, setDisplayedShoe] = useState(currentShoe)
  const currentShoeIdRef = useRef(currentShoe?.id)
  const queuedShoeRef = useRef(null)
  const isAnimatingRef = useRef(false)
  const priceInnerRef = useRef(null)
  const dragHintRef = useRef(null)
  const toggleBtnRef = useRef(null)
  const thumbnailsRef = useRef(null)

  // Magnetic hover refs for toggle button
  const gridBtnIconRef = useRef(null)
  const gridBtnMagPipes = useRef(null)

  const initBtnMagnetic = useCallback((el) => {
    if (!el) return
    toggleBtnRef.current = el
    gridBtnMagPipes.current = {
      x: gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' }),
    }
  }, [])

  const handleBtnPointerMove = useCallback((e) => {
    const btn = toggleBtnRef.current
    if (!btn || !gridBtnMagPipes.current) return
    const rect = btn.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const nx = Math.max(-1, Math.min(1, dx / (rect.width / 2)))
    const ny = Math.max(-1, Math.min(1, dy / (rect.height / 2)))
    gridBtnMagPipes.current.x(nx * 6)
    gridBtnMagPipes.current.y(ny * 4)
    if (gridBtnIconRef.current) {
      gsap.to(gridBtnIconRef.current, {
        rotation: nx * 14,
        scale: 1.22,
        duration: 0.35,
        ease: 'power3.out',
        overwrite: 'auto',
      })
    }
  }, [])

  const handleBtnPointerLeave = useCallback(() => {
    if (gridBtnMagPipes.current) {
      gridBtnMagPipes.current.x(0)
      gridBtnMagPipes.current.y(0)
    }
    if (gridBtnIconRef.current) {
      gsap.to(gridBtnIconRef.current, {
        rotation: 0,
        scale: 1,
        duration: 0.5,
        ease: 'elastic.out(1, 0.35)',
        overwrite: 'auto',
      })
    }
  }, [])

  const runPriceTransition = (newShoe) => {
    if (!newShoe || newShoe.id === currentShoeIdRef.current) return
    currentShoeIdRef.current = newShoe.id
    queuedShoeRef.current = newShoe

    const el = priceInnerRef.current
    if (!el) return
    gsap.killTweensOf(el)
    isAnimatingRef.current = true

    // ── PHASE 1: OUTGOING PRICE ──
    gsap.to(el, {
      yPercent: 110,
      opacity: 0,
      duration: 0.22,
      ease: 'power3.in',
      onComplete: () => {
        const shoeToDisplay = queuedShoeRef.current || newShoe
        setDisplayedShoe(shoeToDisplay)
        gsap.set(el, { yPercent: 110, opacity: 0 })

        // ── PHASE 2: INCOMING PRICE ──
        gsap.to(el, {
          yPercent: 0,
          opacity: 1,
          duration: 0.38,
          ease: 'power3.out',
          onComplete: () => {
            isAnimatingRef.current = false
            if (queuedShoeRef.current && queuedShoeRef.current.id !== shoeToDisplay.id) {
              runPriceTransition(queuedShoeRef.current)
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
      runPriceTransition(newShoe)
    },
    // View transition: Text moves down inside clipping boundary
    animateTextOut() {
      const els = [priceInnerRef.current, dragHintRef.current].filter(Boolean)
      gsap.killTweensOf(els)
      return gsap.to(els, {
        yPercent: 110,
        opacity: 0,
        duration: 0.28,
        stagger: 0.02,
        ease: 'power3.in',
      })
    },
    // View transition: Controls pop out (subtle scale & opacity)
    popOut() {
      const controls = [toggleBtnRef.current, thumbnailsRef.current].filter(Boolean)
      gsap.killTweensOf(controls)
      return gsap.to(controls, {
        scale: 0.92,
        opacity: 0,
        duration: 0.28,
        ease: 'power2.in',
      })
    },
    // View transition: Prepare initial state before entrance
    prepareEntrance(shoe) {
      if (shoe) {
        currentShoeIdRef.current = shoe.id
        setDisplayedShoe(shoe)
      }
      const els = [priceInnerRef.current, dragHintRef.current].filter(Boolean)
      const controls = [toggleBtnRef.current, thumbnailsRef.current].filter(Boolean)
      gsap.killTweensOf([...els, ...controls])
      gsap.set(els, { yPercent: 110, opacity: 0 })
      gsap.set(controls, { scale: 0.88, opacity: 0 })
    },
    // View transition: Controls pop in (scale: 0.88 -> 1, opacity: 0 -> 1)
    popIn(duration = 0.55) {
      const controls = [toggleBtnRef.current, thumbnailsRef.current].filter(Boolean)
      gsap.killTweensOf(controls)
      return gsap.to(controls, {
        scale: 1,
        opacity: 1,
        duration,
        ease: 'power3.out',
      })
    },
    // View transition: Text emerges upward from clipping line (y: 110% -> 0%)
    animateTextIn(duration = 0.55) {
      const els = [priceInnerRef.current, dragHintRef.current].filter(Boolean)
      gsap.killTweensOf(els)
      return gsap.to(els, {
        yPercent: 0,
        opacity: 1,
        duration,
        stagger: 0.03,
        ease: 'power3.out',
      })
    },
  }))

  return (
    <div className="relative z-30 w-full flex items-end justify-between pt-2 pb-1 select-none pointer-events-auto">
      {/* ── Left: Drag To Explore Hint (Masked in overflow-hidden) ── */}
      <div className="flex-1 flex items-center">
        <div className="overflow-hidden">
          <span
            ref={dragHintRef}
            className="block text-[13px] font-normal text-neutral-500 tracking-wide will-change-transform"
          >
            Drag To Explore
          </span>
        </div>
      </div>

      {/* ── Center: Grid View Toggle Button with magnetic hover ── */}
      <div className="flex-1 flex justify-center">
        <button
          ref={initBtnMagnetic}
          type="button"
          onClick={onOpenGridView}
          onPointerMove={handleBtnPointerMove}
          onPointerLeave={handleBtnPointerLeave}
          className="bg-[#141416] hover:bg-black text-white px-5 py-2.5 rounded-lg flex items-center gap-2.5 text-[14px] font-normal tracking-wide shadow-sm cursor-pointer will-change-transform"
        >
          <span ref={gridBtnIconRef} className="flex items-center justify-center will-change-transform">
            <LayoutGrid className="w-4 h-4 text-white" strokeWidth={2} />
          </span>
          <span>Grid View</span>
        </button>
      </div>

      {/* ── Right: Large Price + Angle Thumbnails ── */}
      <div className="flex-1 flex flex-col items-end gap-2.5">
        {/* Large Product Price in Indian Rupees with hidden-line clip reveal */}
        <div className="overflow-hidden min-h-[36px] flex items-center justify-end">
          <p
            ref={priceInnerRef}
            className="text-2xl sm:text-3xl font-medium tracking-tight text-neutral-900 will-change-transform m-0"
          >
            {displayedShoe.price}
          </p>
        </div>

        {/* 4 Angle Thumbnails */}
        <div ref={thumbnailsRef} className="flex items-center gap-2 will-change-transform">
          {[0, 1, 2, 3].map((index) => {
            const isSelected = activeThumbnail === index
            return (
              <button
                key={index}
                type="button"
                onClick={() => onSelectThumbnail(index)}
                className={`w-11 h-11 rounded-lg bg-[#EFEFEF] hover:bg-[#E5E5E5] transition-all p-1 flex items-center justify-center cursor-pointer border ${
                  isSelected ? 'border-neutral-900 bg-white shadow-sm' : 'border-transparent'
                }`}
                title={`View angle ${index + 1}`}
              >
                <img
                  src={currentShoe.image}
                  alt={`Angle ${index + 1}`}
                  className={`w-full h-full object-contain ${
                    index === 1
                      ? 'scale-110 rotate-45'
                      : index === 2
                      ? 'scale-95 -rotate-12'
                      : index === 3
                      ? 'scale-110 -scale-x-100'
                      : ''
                  }`}
                  draggable={false}
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})

export default BottomControls
