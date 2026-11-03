import { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import { ChevronDown, Heart, User, ShoppingCart, MousePointerClick, Menu, X } from 'lucide-react'
import Logo from './Logo'

/**
 * GridView — Catalogue view strictly matching the reference design.
 *
 * Typography:
 *   - Sneaker names in cards strictly set to PP Neue Montreal Medium (500).
 *
 * Add to Cart:
 *   - Hidden by default on mouse devices.
 *   - Smoothly slides upward and fades in when card is hovered.
 *   - Slides down on mouse leave.
 *   - Always visible on touch/mobile devices without requiring hover.
 *   - Price remains visible at all times.
 *
 * Toggle Button:
 *   - Magnetic hover: button follows cursor subtly.
 *   - Icon animation: icon rotates and scales on hover, snaps back with elastic ease.
 *   - Icon: MousePointerClick for "Interactive View".
 *
 * Coordinated GSAP Pop Transition:
 *   - All text masked inside overflow-hidden wrappers.
 *   - Exit: Text slides DOWN (translateY 0 -> 110%), cards move down and pop out.
 *   - Entrance: Cards enter from below with stagger.
 *   - Text emerges UPWARD out of clipping line (translateY 110% -> 0).
 */
const GridView = forwardRef(function GridView(
  { shoes, isOpen, onExit, onSelectShoe },
  ref
) {
  const panelRef = useRef(null)
  const cardRefs = useRef([])
  const shoeMagneticRefs = useRef([])
  const magneticPipesRef = useRef([])
  const addToCartBtnRefs = useRef([])
  const toggleBtnRef = useRef(null)
  const toggleBtnIconRef = useRef(null)
  const toggleBtnMagPipes = useRef(null)

  // Text masking refs for overflow-hidden reveals
  const headingLine1Ref = useRef(null)
  const headingLine2Ref = useRef(null)
  const introDescRef = useRef(null)
  const cardNameRefs = useRef([])
  const cardPriceRefs = useRef([])

  const [isWishlisted, setIsWishlisted] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // When opened, scroll to top
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.scrollTop = 0
    }
  }, [isOpen])

  // Pre-initialize GSAP quickTo pipes for magnetic interaction on each sneaker card
  useEffect(() => {
    magneticPipesRef.current = shoes.map((_, i) => {
      const el = shoeMagneticRefs.current[i]
      if (!el) return null
      return {
        x: gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' }),
        y: gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' }),
        rot: gsap.quickTo(el, 'rotation', { duration: 0.45, ease: 'power3.out' }),
        scale: gsap.quickTo(el, 'scale', { duration: 0.45, ease: 'power3.out' }),
      }
    })
  }, [shoes])

  // Initial check for mouse/touch capability to set Add to Cart button initial state
  useEffect(() => {
    const isTouch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (isTouch) {
      // On touch devices, keep all Add to Cart buttons visible
      addToCartBtnRefs.current.forEach((btn) => {
        if (btn) gsap.set(btn, { opacity: 1, y: 0 })
      })
    } else {
      // On desktop with fine pointer, hide by default
      addToCartBtnRefs.current.forEach((btn) => {
        if (btn) gsap.set(btn, { opacity: 0, y: 14 })
      })
    }
  }, [])

  // ── Magnetic & Add to Cart Hover Handlers ──
  const handleCardPointerMove = (i, e) => {
    if (typeof window === 'undefined') return
    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!isFinePointer) return

    const card = cardRefs.current[i]
    if (!card) return
    const rect = card.getBoundingClientRect()

    // Card center
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const dx = e.clientX - centerX
    const dy = e.clientY - centerY

    // Normalized relative offset [-1, 1]
    const nx = Math.max(-1, Math.min(1, dx / (rect.width / 2)))
    const ny = Math.max(-1, Math.min(1, dy / (rect.height / 2)))

    // Magnetic pull distance (sticks to cursor within card)
    const maxOffsetX = 32
    const maxOffsetY = 24
    const targetX = nx * maxOffsetX
    const targetY = ny * maxOffsetY
    // Dynamic subtle rotation with slight tilt
    const targetRot = -3 + nx * 4.5

    const pipes = magneticPipesRef.current[i]
    if (pipes) {
      pipes.x(targetX)
      pipes.y(targetY)
      pipes.rot(targetRot)
      pipes.scale(1.05)
    }

    // Animate Add to Cart button smoothly upward
    const cartBtn = addToCartBtnRefs.current[i]
    if (cartBtn && !cartBtn._isHovered) {
      cartBtn._isHovered = true
      gsap.to(cartBtn, {
        y: 0,
        opacity: 1,
        duration: 0.3,
        ease: 'power3.out',
        overwrite: 'auto',
      })
    }
  }

  const handleCardPointerLeave = (i) => {
    // Reset magnetic position
    const pipes = magneticPipesRef.current[i]
    if (pipes) {
      pipes.x(0)
      pipes.y(0)
      pipes.rot(0)
      pipes.scale(1)
    }

    // Slide Add to Cart button down and fade out on fine pointer devices
    const isFinePointer = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (isFinePointer) {
      const cartBtn = addToCartBtnRefs.current[i]
      if (cartBtn) {
        cartBtn._isHovered = false
        gsap.to(cartBtn, {
          y: 14,
          opacity: 0,
          duration: 0.24,
          ease: 'power2.in',
          overwrite: 'auto',
        })
      }
    }
  }

  // ── Magnetic hover for Interactive View toggle button ──
  const initToggleMagnetic = useCallback((el) => {
    if (!el) return
    toggleBtnRef.current = el
    toggleBtnMagPipes.current = {
      x: gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' }),
    }
  }, [])

  const handleTogglePointerMove = useCallback((e) => {
    const btn = toggleBtnRef.current
    if (!btn || !toggleBtnMagPipes.current) return
    const rect = btn.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const nx = Math.max(-1, Math.min(1, dx / (rect.width / 2)))
    const ny = Math.max(-1, Math.min(1, dy / (rect.height / 2)))
    toggleBtnMagPipes.current.x(nx * 6)
    toggleBtnMagPipes.current.y(ny * 4)
    if (toggleBtnIconRef.current) {
      gsap.to(toggleBtnIconRef.current, {
        rotation: nx * 14,
        scale: 1.22,
        duration: 0.35,
        ease: 'power3.out',
        overwrite: 'auto',
      })
    }
  }, [])

  const handleTogglePointerLeave = useCallback(() => {
    if (toggleBtnMagPipes.current) {
      toggleBtnMagPipes.current.x(0)
      toggleBtnMagPipes.current.y(0)
    }
    if (toggleBtnIconRef.current) {
      gsap.to(toggleBtnIconRef.current, {
        rotation: 0,
        scale: 1,
        duration: 0.5,
        ease: 'elastic.out(1, 0.35)',
        overwrite: 'auto',
      })
    }
  }, [])

  const getAllTextElements = () => {
    return [
      headingLine1Ref.current,
      headingLine2Ref.current,
      introDescRef.current,
      ...cardNameRefs.current,
      ...cardPriceRefs.current,
    ].filter(Boolean)
  }

  // Imperative handle for coordinated transition and direct DOM visibility control
  useImperativeHandle(ref, () => ({
    scrollToTop() {
      if (panelRef.current) panelRef.current.scrollTop = 0
    },
    hideImmediately() {
      if (panelRef.current) {
        panelRef.current.style.visibility = 'hidden'
        panelRef.current.style.pointerEvents = 'none'
      }
    },
    showImmediately() {
      if (panelRef.current) {
        panelRef.current.scrollTop = 0
        panelRef.current.style.visibility = 'visible'
        panelRef.current.style.pointerEvents = 'auto'
      }
    },
    // View transition: Current text moves down and disappears inside clipping boundary
    animateTextOut() {
      const textEls = getAllTextElements()
      gsap.killTweensOf(textEls)
      return gsap.to(textEls, {
        yPercent: 110,
        opacity: 0,
        duration: 0.26,
        stagger: 0.02,
        ease: 'power3.in',
      })
    },
    // View transition: Cards move downward and pop out (scale + opacity)
    popOut() {
      const cards = cardRefs.current.filter(Boolean)
      const toggle = toggleBtnRef.current
      gsap.killTweensOf([...cards, toggle].filter(Boolean))

      if (toggle) {
        gsap.to(toggle, { y: 15, opacity: 0, duration: 0.24, ease: 'power2.in' })
      }

      return gsap.to(cards, {
        y: 40,
        scale: 0.94,
        opacity: 0,
        duration: 0.3,
        stagger: 0.03,
        ease: 'power2.in',
      })
    },
    // View transition: Prepare initial state before entrance
    prepareEntrance() {
      if (panelRef.current) panelRef.current.scrollTop = 0
      const cards = cardRefs.current.filter(Boolean)
      const textEls = getAllTextElements()
      const toggle = toggleBtnRef.current

      gsap.killTweensOf([...cards, ...textEls, toggle].filter(Boolean))
      gsap.set(cards, { y: 45, scale: 0.94, opacity: 0 })
      gsap.set(textEls, { yPercent: 110, opacity: 0 })
      if (toggle) gsap.set(toggle, { y: 15, opacity: 0 })
    },
    // View transition: Cards pop into position (enter from below)
    popIn() {
      const cards = cardRefs.current.filter(Boolean)
      const toggle = toggleBtnRef.current
      gsap.killTweensOf([...cards, toggle].filter(Boolean))

      if (toggle) {
        gsap.to(toggle, { y: 0, opacity: 1, duration: 0.38, ease: 'power3.out', delay: 0.1 })
      }

      return gsap.to(cards, {
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 0.44,
        stagger: 0.04,
        ease: 'power3.out',
      })
    },
    // View transition: Text moves upward out of clipping lines
    animateTextIn() {
      const textEls = getAllTextElements()
      gsap.killTweensOf(textEls)
      return gsap.to(textEls, {
        yPercent: 0,
        opacity: 1,
        duration: 0.42,
        stagger: 0.025,
        ease: 'power3.out',
      })
    },
  }))

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-40 overflow-y-auto bg-white text-neutral-900 select-none"
      style={{
        visibility: isOpen ? 'visible' : 'hidden',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      <div className="w-full p-6 md:p-8 lg:p-10 flex flex-col min-h-screen">
        {/* ── 1. Top Navbar: Logo (Left) | Navigation (Right) ── */}
        <header className="w-full flex items-center justify-between pb-4">
          {/* Logo on the left */}
          <div className="flex items-center">
            <Logo />
          </div>

          {/* Desktop Nav Pill on the right */}
          <div className="hidden md:flex items-center">
            <nav
              aria-label="Grid Navigation"
              className="bg-[#F6F6F6] px-8 py-3 flex items-center gap-8 text-[18px] font-normal text-neutral-800"
            >
              <a
                href="#collections"
                className="flex items-center gap-2 hover:text-black transition-colors"
                onClick={(e) => e.preventDefault()}
              >
                <span>Collections</span>
                <ChevronDown className="w-4 h-4 text-neutral-800" strokeWidth={2.2} />
              </a>

              <a
                href="#about"
                className="hover:text-black transition-colors"
                onClick={(e) => e.preventDefault()}
              >
                About
              </a>

              <button
                type="button"
                onClick={() => setIsWishlisted((prev) => !prev)}
                className="flex items-center justify-center hover:text-black transition-colors focus:outline-none cursor-pointer"
                aria-label="Wishlist"
              >
                <Heart
                  className={`w-[18px] h-[18px] transition-colors ${
                    isWishlisted ? 'fill-red-500 text-red-500' : 'text-neutral-800 hover:text-black'
                  }`}
                  strokeWidth={2.2}
                />
              </button>

              <button
                type="button"
                className="flex items-center justify-center text-neutral-800 hover:text-black transition-colors focus:outline-none cursor-pointer"
                aria-label="Account"
              >
                <User className="w-[18px] h-[18px]" strokeWidth={2.2} />
              </button>

              <button
                type="button"
                onClick={() => setCartCount((prev) => prev + 1)}
                className="relative flex items-center justify-center text-neutral-800 hover:text-black transition-colors focus:outline-none cursor-pointer"
                aria-label={`Cart (${cartCount} items)`}
              >
                <ShoppingCart className="w-[18px] h-[18px]" strokeWidth={2.2} />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Mobile Nav Icons */}
          <div className="flex md:hidden items-center gap-3">
            <button
              type="button"
              onClick={() => setCartCount((prev) => prev + 1)}
              className="p-2 text-neutral-800 relative"
              aria-label="Cart"
            >
              <ShoppingCart className="w-5 h-5" strokeWidth={2.2} />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="p-2 text-neutral-800"
              aria-label="Menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </header>

        {/* Mobile menu dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden mb-6 p-4 bg-[#F6F6F6] flex flex-col gap-3 border border-neutral-200">
            <a
              href="#collections"
              className="flex items-center justify-between text-neutral-800 py-1.5 text-base font-normal"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>Collections</span>
              <ChevronDown className="w-4 h-4 text-neutral-800" strokeWidth={2.2} />
            </a>
            <a
              href="#about"
              className="text-neutral-800 py-2 border-t border-neutral-200 text-base font-normal"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              About
            </a>
          </div>
        )}

        {/* ── 2. Two-Column Introduction Section (Masked Lines) ── */}
        <section className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-start sm:items-end pt-10 sm:pt-14 md:pt-16 pb-12 sm:pb-16">
          {/* Left Column: Large Heading with Overflow Masked Lines */}
          <div className="md:col-span-7 lg:col-span-8 flex flex-col justify-center">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[76px] font-medium tracking-tight text-neutral-900 leading-[1.04] m-0 p-0">
              <span className="block overflow-hidden pb-1">
                <span ref={headingLine1Ref} className="block will-change-transform">
                  Explore Our
                </span>
              </span>
              <span className="block overflow-hidden pb-1">
                <span ref={headingLine2Ref} className="block will-change-transform">
                  Sneakers Collection
                </span>
              </span>
            </h1>
          </div>

          {/* Right Column: Collection description with Overflow Masked Line */}
          <div className="md:col-span-5 lg:col-span-4 flex justify-start md:justify-end items-end pt-2 md:pt-0">
            <div className="overflow-hidden">
              <p
                ref={introDescRef}
                className="text-[15px] sm:text-[16px] text-neutral-600 font-normal leading-relaxed max-w-sm text-left m-0 will-change-transform"
              >
                Classic cream and deep green sneakers with a bold kangaroo graphic, earthy accents, and a comfortable everyday fit.
              </p>
            </div>
          </div>
        </section>

        {/* ── 3. Product Grid (3 cols Row 1, 2 cards Row 2) ── */}
        <section
          className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 lg:gap-8 pb-32"
        >
          {shoes.map((shoe, i) => (
            <div
              key={shoe.id}
              ref={(el) => (cardRefs.current[i] = el)}
              onClick={() => onSelectShoe(shoe.id)}
              onPointerMove={(e) => handleCardPointerMove(i, e)}
              onPointerLeave={() => handleCardPointerLeave(i)}
              className="group relative flex flex-col justify-between bg-[#F5F5F5] rounded-none sm:rounded-[2px] p-7 sm:p-9 min-h-[440px] sm:min-h-[480px] lg:min-h-[500px] transition-shadow duration-300 hover:shadow-sm cursor-pointer select-none will-change-transform"
            >
              {/* Product Name at top-left — PP Neue Montreal Medium (500) with Overflow Mask */}
              <div className="w-full flex items-start justify-between min-h-[32px] overflow-hidden">
                <h3
                  ref={(el) => (cardNameRefs.current[i] = el)}
                  className="font-['PP_Neue_Montreal'] font-medium text-xl sm:text-2xl text-neutral-900 tracking-tight block m-0 p-0 will-change-transform"
                >
                  {shoe.name}
                </h3>
              </div>

              {/* Large sneaker image centred in card with magnetic cursor tracking */}
              <div className="my-auto py-4 sm:py-6 flex items-center justify-center w-full h-[230px] sm:h-[260px] lg:h-[290px] overflow-visible">
                <div
                  ref={(el) => (shoeMagneticRefs.current[i] = el)}
                  className="w-full h-full flex items-center justify-center will-change-transform"
                >
                  <img
                    src={shoe.image}
                    alt={shoe.name}
                    className="max-h-full max-w-full object-contain pointer-events-none select-none"
                    draggable={false}
                  />
                </div>
              </div>

              {/* Bottom row: Price at bottom-left | "Add to Cart" at bottom-right */}
              <div className="w-full flex items-center justify-between pt-4 mt-auto min-h-[42px] overflow-hidden">
                {/* Price visible at all times with Overflow Mask */}
                <div className="overflow-hidden min-h-[32px] flex items-center">
                  <span
                    ref={(el) => (cardPriceRefs.current[i] = el)}
                    className="text-2xl sm:text-[26px] font-normal text-neutral-900 tracking-tight block will-change-transform"
                  >
                    {shoe.price}
                  </span>
                </div>

                {/* Add to Cart button (slides upward on card hover, visible on touch) */}
                <div
                  ref={(el) => (addToCartBtnRefs.current[i] = el)}
                  className="will-change-transform flex items-center"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCartCount((c) => c + 1)
                    }}
                    className="border border-neutral-400/90 hover:border-black rounded-[4px] px-3.5 py-1.5 text-[12px] sm:text-[13px] text-neutral-800 hover:text-white hover:bg-neutral-900 font-normal transition-colors duration-150 cursor-pointer"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* ── 4. Floating View Toggle Button ("Interactive View") with magnetic hover ── */}
      <div
        ref={initToggleMagnetic}
        className="fixed bottom-7 left-1/2 -translate-x-1/2 z-50 pointer-events-auto will-change-transform"
      >
        <button
          type="button"
          onClick={() => onExit && onExit()}
          onPointerMove={handleTogglePointerMove}
          onPointerLeave={handleTogglePointerLeave}
          className="bg-[#18181A] hover:bg-black text-white px-5 py-2.5 rounded-lg flex items-center gap-2.5 text-[13.5px] font-normal tracking-wide shadow-2xl cursor-pointer select-none"
        >
          <span ref={toggleBtnIconRef} className="flex items-center justify-center will-change-transform">
            <MousePointerClick className="w-4 h-4 text-white" strokeWidth={2} />
          </span>
          <span>Interactive View</span>
        </button>
      </div>
    </div>
  )
})

export default GridView
