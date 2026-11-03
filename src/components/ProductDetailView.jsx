import { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import { ArrowLeft, ShoppingCart, Heart, User, ChevronDown, Check, Menu, X } from 'lucide-react'
import Logo from './Logo'
import { getProductGallery } from '../data/productGalleries'

/**
 * ProductDetailView — Sneaker Product Detail Experience
 *
 * Requirements:
 * 1. Logo on left: Exactly like Grid View navbar.
 * 2. Equal padding from all sides: Uses p-6 md:p-8 lg:p-10 (24px / 32px / 40px) matching the other views.
 * 3. Transparent navbar: No background fill or blur.
 * 4. Infinite Vertical Scrolling: Images cycle infinitely along the vertical track using modular arithmetic,
 *    identical to the horizontal orbital carousel in Interactive View! Supports mouse wheel, pointer drag,
 *    touch swipe, and arrow keys with natural inertia and snapping.
 * 5. Coordinated FLIP transitions with symmetric enter and exit animations.
 */
const ProductDetailView = forwardRef(function ProductDetailView(
  { shoe, isOpen, onClose },
  ref
) {
  const panelRef = useRef(null)
  const streamContainerRef = useRef(null)
  const itemRefs = useRef([])
  const heroImgRef = useRef(null)
  const detailLogoRef = useRef(null)
  const backPillRef = useRef(null)
  const scrollHintRef = useRef(null)
  const leftColRef = useRef(null)
  const rightColRef = useRef(null)

  // Text masking refs for overflow-hidden reveals
  const titleLineRef = useRef(null)
  const descLineRef = useRef(null)
  const detailsTriggerRef = useRef(null)
  const priceRef = useRef(null)
  const sizeHeaderRef = useRef(null)
  const sizeGridRef = useRef(null)
  const cartBtnRef = useRef(null)

  const [selectedSize, setSelectedSize] = useState(42)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Visibility toggle for hero image handoff
  const isHeroImgVisibleRef = useRef(false)

  // Infinite vertical scrolling progress proxy
  const progressProxyRef = useRef({ progress: 2 })
  const isDraggingRef = useRef(false)
  const startYRef = useRef(0)
  const lastYRef = useRef(0)
  const lastTimeRef = useRef(0)
  const velocityYRef = useRef(0)
  const startProgressRef = useRef(2)
  const totalDragDistRef = useRef(0)
  const wheelSnapTimerRef = useRef(null)

  // Prepare full list of gallery images: [above1, above2, heroImage, below1, below2]
  const gallery = shoe ? getProductGallery(shoe.id) : { above: [], below: [] }
  const allImages = shoe
    ? [
        ...(gallery.above || []),
        shoe.image,
        ...(gallery.below || []),
      ].filter(Boolean)
    : []

  const total = allImages.length
  // Hero sneaker index inside allImages array
  const heroIndex = (gallery.above || []).length

  // Default to size 42 or first in-stock size when shoe changes
  useEffect(() => {
    if (shoe?.sizes) {
      const has42 = shoe.sizes.find((s) => s.size === 42 && s.inStock)
      setSelectedSize(has42 ? 42 : (shoe.sizes.find((s) => s.inStock)?.size ?? shoe.sizes[0]?.size))
    }
    setIsDetailsOpen(false)
  }, [shoe])

  // ── Mathematical Infinite Vertical Stream Position Update ──
  const updatePositions = useCallback((progress) => {
    if (total === 0) return
    const vh = window.innerHeight
    const step = Math.min(vh * 0.48, 400)

    allImages.forEach((_, idx) => {
      const el = itemRefs.current[idx]
      if (!el) return

      let diff = (idx - (progress % total)) % total
      if (diff < -total / 2) diff += total
      if (diff > total / 2) diff -= total
      const u = diff
      const absU = Math.abs(u)

      // Vertical coordinate relative to viewport center
      const y = u * step

      // Subtle scale perspective: 1.0 at center, gently tapering off
      const scale = Math.max(0.74, 1.0 - Math.pow(absU, 1.2) * 0.08)

      // Seamless infinite opacity: 1.0 in view, fading to 0 at wrap boundary |u| >= 2.5
      let opacity = 1.0
      if (absU <= 1.5) {
        opacity = 1.0
      } else if (absU <= 2.2) {
        opacity = 1.0 - (absU - 1.5) * 0.5
      } else {
        opacity = Math.max(0, 0.65 - (absU - 2.2) * 2.1)
      }

      // Hide hero image during FLIP entrance until handoff
      const isHero = idx === heroIndex
      const finalOpacity = (isHero && !isHeroImgVisibleRef.current) ? 0 : opacity

      gsap.set(el, {
        xPercent: -50,
        yPercent: -50,
        y,
        scale,
        opacity: finalOpacity,
        zIndex: Math.round(25 - absU * 4),
        force3D: true,
      })
    })
  }, [allImages, total, heroIndex])

  // Reset infinite stream progress to center on the hero sneaker
  const resetToHero = useCallback(() => {
    progressProxyRef.current.progress = heroIndex
    updatePositions(heroIndex)
  }, [heroIndex, updatePositions])

  useEffect(() => {
    if (isOpen) {
      resetToHero()
    }
  }, [isOpen, resetToHero])

  // ── Mouse Wheel / Trackpad Infinite Scroll ──
  useEffect(() => {
    if (!isOpen || total <= 1) return
    const container = streamContainerRef.current
    if (!container) return

    let snapTimer = null

    const handleWheel = (e) => {
      e.preventDefault()
      if (isDraggingRef.current) return

      const delta = e.deltaY * 0.0022
      const targetP = progressProxyRef.current.progress + delta

      gsap.killTweensOf(progressProxyRef.current)
      gsap.to(progressProxyRef.current, {
        progress: targetP,
        duration: 0.28,
        ease: 'power2.out',
        overwrite: 'auto',
        onUpdate: () => {
          updatePositions(progressProxyRef.current.progress)
        },
      })

      clearTimeout(snapTimer)
      snapTimer = setTimeout(() => {
        if (isDraggingRef.current) return
        const snapTarget = Math.round(progressProxyRef.current.progress)
        gsap.to(progressProxyRef.current, {
          progress: snapTarget,
          duration: 0.42,
          ease: 'power3.out',
          onUpdate: () => {
            updatePositions(progressProxyRef.current.progress)
          },
        })
      }, 160)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
      clearTimeout(snapTimer)
    }
  }, [isOpen, total, updatePositions])

  // ── Keyboard Infinite Scroll (ArrowUp / ArrowDown) ──
  useEffect(() => {
    if (!isOpen || total <= 1) return
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        const snapTarget = Math.round(progressProxyRef.current.progress) + 1
        gsap.to(progressProxyRef.current, {
          progress: snapTarget,
          duration: 0.45,
          ease: 'power3.out',
          onUpdate: () => updatePositions(progressProxyRef.current.progress),
        })
      } else if (e.key === 'ArrowUp') {
        const snapTarget = Math.round(progressProxyRef.current.progress) - 1
        gsap.to(progressProxyRef.current, {
          progress: snapTarget,
          duration: 0.45,
          ease: 'power3.out',
          onUpdate: () => updatePositions(progressProxyRef.current.progress),
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, total, updatePositions])

  // ── Pointer Drag (Mouse Click & Drag / Touch Swipe) ──
  const handlePointerDown = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return
    if (total <= 1) return

    isDraggingRef.current = true
    startYRef.current = e.clientY
    lastYRef.current = e.clientY
    lastTimeRef.current = performance.now()
    velocityYRef.current = 0
    totalDragDistRef.current = 0
    startProgressRef.current = progressProxyRef.current.progress

    gsap.killTweensOf(progressProxyRef.current)
    try {
      e.currentTarget?.setPointerCapture(e.pointerId)
    } catch {}
  }

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return
    const now = performance.now()
    const dt = now - lastTimeRef.current
    const clientY = e.clientY

    if (dt > 10) {
      velocityYRef.current = (clientY - lastYRef.current) / dt
      lastYRef.current = clientY
      lastTimeRef.current = now
    }

    const deltaY = clientY - startYRef.current
    totalDragDistRef.current = Math.abs(deltaY)

    const vh = window.innerHeight
    const step = Math.min(vh * 0.48, 400)
    const newProgress = startProgressRef.current - deltaY / step
    progressProxyRef.current.progress = newProgress
    updatePositions(newProgress)
  }

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    try {
      e.currentTarget?.releasePointerCapture(e.pointerId)
    } catch {}

    const vh = window.innerHeight
    const step = Math.min(vh * 0.48, 400)
    const v = velocityYRef.current
    const momentumOffset = -(v * 160) / step
    const snapTarget = Math.round(progressProxyRef.current.progress + momentumOffset)
    const dist = Math.abs(snapTarget - progressProxyRef.current.progress)
    const duration = Math.min(0.68, Math.max(0.32, dist * 0.4))

    gsap.to(progressProxyRef.current, {
      progress: snapTarget,
      duration,
      ease: 'power3.out',
      onUpdate: () => {
        updatePositions(progressProxyRef.current.progress)
      },
    })
  }

  // Collect text elements for clipping animations
  const getTextEls = () => [
    titleLineRef.current,
    descLineRef.current,
    detailsTriggerRef.current,
    priceRef.current,
    sizeHeaderRef.current,
    sizeGridRef.current,
    cartBtnRef.current,
  ].filter(Boolean)

  // ── Imperative API for Coordinated GSAP Transitions ──
  useImperativeHandle(ref, () => ({
    getHeroRect() {
      if (heroImgRef.current) {
        const r = heroImgRef.current.getBoundingClientRect()
        if (r.width > 40 && r.height > 40) return r
      }
      const vw = window.innerWidth
      const vh = window.innerHeight
      const h = Math.min(vh * 0.42, 400)
      const w = h * (1200 / 875)
      return {
        left: (vw - w) / 2,
        top: (vh - h) / 2,
        width: w,
        height: h,
      }
    },

    setHeroImageVisible(visible) {
      isHeroImgVisibleRef.current = visible
      updatePositions(progressProxyRef.current.progress)
    },

    setLogoVisible(visible) {
      if (detailLogoRef.current) {
        gsap.set(detailLogoRef.current, { opacity: visible ? 1 : 0 })
      }
    },

    scrollToCenter: resetToHero,

    hideImmediately() {
      if (panelRef.current) {
        panelRef.current.style.visibility = 'hidden'
        panelRef.current.style.pointerEvents = 'none'
        panelRef.current.style.opacity = '1'
      }
    },

    showImmediately() {
      if (panelRef.current) {
        panelRef.current.style.opacity = '1'
        panelRef.current.style.visibility = 'visible'
        panelRef.current.style.pointerEvents = 'auto'
      }
      resetToHero()
    },

    prepareEntrance() {
      resetToHero()
      isHeroImgVisibleRef.current = false
      if (detailLogoRef.current) gsap.set(detailLogoRef.current, { opacity: 0 })
      if (panelRef.current) panelRef.current.style.opacity = '1'
      updatePositions(heroIndex)

      const els = getTextEls()
      gsap.killTweensOf(els)
      gsap.set(els, { yPercent: 115, opacity: 0 })
      if (backPillRef.current) gsap.set(backPillRef.current, { scale: 0.78, opacity: 0, y: 14 })
      if (scrollHintRef.current) gsap.set(scrollHintRef.current, { opacity: 0 })
    },

    animateIn() {
      const els = getTextEls()
      const extra = [backPillRef.current, scrollHintRef.current].filter(Boolean)
      gsap.killTweensOf([...els, ...extra])

      const tl = gsap.timeline()

      // Text lines emerge upward out of clipping lines
      tl.to(els, {
        yPercent: 0,
        opacity: 1,
        duration: 0.50,
        stagger: 0.025,
        ease: 'power3.out',
      }, 0.04)

      // Floating back pill pops in with spring bounce
      if (backPillRef.current) {
        tl.to(backPillRef.current, {
          scale: 1,
          opacity: 1,
          y: 0,
          duration: 0.45,
          ease: 'back.out(1.8)',
        }, 0.08)
      }

      // Scroll hint fades in
      if (scrollHintRef.current) {
        tl.to(scrollHintRef.current, {
          opacity: 1,
          duration: 0.40,
          ease: 'power2.out',
        }, 0.16)
      }

      return tl
    },

    animateOut() {
      const els = getTextEls()
      const extra = [backPillRef.current, scrollHintRef.current].filter(Boolean)
      const nonHeroItemEls = itemRefs.current.filter((_, idx) => idx !== heroIndex)
      gsap.killTweensOf([...els, ...extra, ...nonHeroItemEls, panelRef.current].filter(Boolean))

      const tl = gsap.timeline()

      // Hide detail view static logo so Header's animating logo is visible
      if (detailLogoRef.current) {
        gsap.set(detailLogoRef.current, { opacity: 0 })
      }

      // ── Phase 1: Text elements move DOWN inside overflow-hidden wrappers ──
      // Name, description, price, size selector, Add to Cart, details trigger
      // Start: y: 0%, End: y: 110%, Duration: 0.35s, Easing: power3.in
      tl.to(els, {
        yPercent: 110,
        opacity: 0.2,
        duration: 0.35,
        stagger: 0.012,
        ease: 'power3.in',
      }, 0)

      // ── Phase 1: Product gallery images pop out ──
      // The two images above and two below animate scale: 1 -> 0.85, opacity: 1 -> 0, duration: 0.40s, power2.in
      if (nonHeroItemEls.length > 0) {
        tl.to(nonHeroItemEls, {
          scale: 0.85,
          opacity: 0,
          duration: 0.40,
          ease: 'power2.in',
        }, 0)
      }

      // Back pill & scroll hint pop out smoothly
      if (backPillRef.current) {
        tl.to(backPillRef.current, {
          scale: 0.85,
          opacity: 0,
          y: 8,
          duration: 0.32,
          ease: 'power2.in',
        }, 0)
      }
      if (scrollHintRef.current) {
        tl.to(scrollHintRef.current, {
          opacity: 0,
          duration: 0.25,
          ease: 'power2.in',
        }, 0)
      }

      // If user had scrolled, guide infinite stream back towards hero position
      if (Math.round(progressProxyRef.current.progress) !== heroIndex) {
        tl.to(progressProxyRef.current, {
          progress: heroIndex,
          duration: 0.35,
          ease: 'power2.inOut',
          onUpdate: () => updatePositions(progressProxyRef.current.progress),
        }, 0)
      }

      // White background dissolves by 0.45s, preparing clean transition to Interactive View
      if (panelRef.current) {
        tl.to(panelRef.current, {
          opacity: 0,
          duration: 0.42,
          ease: 'power2.in',
        }, 0)
      }

      return tl
    },
  }))

  if (!shoe) return null

  const handleAddToCart = () => {
    setIsAdded(true)
    setCartCount((c) => c + 1)
    setTimeout(() => setIsAdded(false), 2000)
  }

  // Pre-arrange sizes into 2 rows of 4 as shown in reference:
  // Row 1: 36, 38, 40, 42 — Row 2: 44, 50, 48, 46
  const sizeOrder = [36, 38, 40, 42, 44, 50, 48, 46]
  const displaySizes = sizeOrder
    .map((n) => (shoe.sizes || []).find((s) => s.size === n))
    .filter(Boolean)

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-50 bg-white text-neutral-900 select-none overflow-hidden"
      style={{
        visibility: isOpen ? 'visible' : 'hidden',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      {/* ── 1. Top Navbar: Logo (Left) | Navigation (Right) — Exactly like Grid View ── */}
      <header className="fixed top-0 left-0 right-0 z-40 p-6 md:p-8 lg:p-10 flex items-center justify-between pointer-events-auto bg-transparent">
        {/* Logo strictly on the left */}
        <div ref={detailLogoRef} className="flex items-center will-change-opacity">
          <Logo />
        </div>

        {/* Desktop Nav Pill on the right — exact same style as Grid View */}
        <div className="hidden md:flex items-center">
          <nav
            aria-label="Product Navigation"
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
        <div className="md:hidden fixed top-[72px] left-0 right-0 z-40 p-6 bg-[#F6F6F6] flex flex-col gap-3 shadow-md">
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
            className="text-neutral-800 py-2 text-base font-normal"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            About
          </a>
        </div>
      )}

      {/* ── 2. Left Column: Editorial Product Information (Equal Page Padding) ── */}
      <section
        ref={leftColRef}
        className="hidden lg:flex fixed z-30 pointer-events-auto flex-col gap-4 select-none left-6 md:left-8 lg:left-10 top-1/2 -translate-y-1/2 w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[340px]"
      >
        {/* Product Title inside overflow-hidden clipping wrapper */}
        <div className="overflow-hidden">
          <h1
            ref={titleLineRef}
            className="text-3xl sm:text-4xl lg:text-[40px] font-medium tracking-tight text-neutral-900 leading-[1.08] m-0 will-change-transform font-['PP_Neue_Montreal']"
          >
            {shoe.name}
          </h1>
        </div>

        {/* Product Description inside overflow-hidden clipping wrapper */}
        <div className="overflow-hidden">
          <p
            ref={descLineRef}
            className="text-[14px] leading-relaxed text-neutral-600 font-normal m-0 will-change-transform"
          >
            {shoe.description}
          </p>
        </div>

        {/* Details Pill Accordion Trigger inside overflow-hidden clipping wrapper */}
        <div className="overflow-hidden pt-1">
          <div ref={detailsTriggerRef} className="will-change-transform flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setIsDetailsOpen((prev) => !prev)}
              className="w-full bg-[#F6F6F6] hover:bg-[#EBEBEB] text-neutral-800 px-4 py-2.5 rounded-[6px] text-[13.5px] font-normal flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>Details</span>
              <ChevronDown
                className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${
                  isDetailsOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Expandable Specifications */}
            {isDetailsOpen && shoe.details && (
              <div className="p-3 bg-[#FBFBFB] rounded-[6px] flex flex-col gap-2 text-[12px] text-neutral-600 transition-all">
                <div className="flex justify-between py-0.5">
                  <span className="text-neutral-400">Upper</span>
                  <span className="text-neutral-800 font-medium text-right max-w-[170px]">{shoe.details.upper}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-neutral-400">Sole</span>
                  <span className="text-neutral-800 font-medium text-right max-w-[170px]">{shoe.details.sole}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-neutral-400">Insole</span>
                  <span className="text-neutral-800 font-medium text-right max-w-[170px]">{shoe.details.insole}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-neutral-400">Lining</span>
                  <span className="text-neutral-800 font-medium text-right max-w-[170px]">{shoe.details.lining}</span>
                </div>
                <div className="flex justify-between py-0.5 text-neutral-400 text-[11px]">
                  <span>SKU</span>
                  <span className="font-mono text-neutral-600">{shoe.details.sku}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 3. Right Column: Purchase Controls & Size Selector (Equal Page Padding) ── */}
      <section
        ref={rightColRef}
        className="hidden lg:flex fixed z-30 pointer-events-auto flex-col gap-6 select-none right-6 md:right-8 lg:right-10 top-1/2 -translate-y-1/2 w-full max-w-[260px] sm:max-w-[280px] lg:max-w-[300px]"
      >
        {/* Price inside overflow-hidden clipping wrapper */}
        <div className="overflow-hidden">
          <div ref={priceRef} className="will-change-transform">
            <span className="block text-[12.5px] font-normal text-neutral-400 mb-0.5">
              Price (Incl. Taxes)
            </span>
            <div className="text-3xl sm:text-4xl font-normal text-neutral-900 tracking-tight font-['PP_Neue_Montreal']">
              {shoe.price}
            </div>
          </div>
        </div>

        {/* Size Selection inside overflow-hidden clipping wrapper */}
        <div className="flex flex-col gap-2.5">
          <div className="overflow-hidden">
            <div
              ref={sizeHeaderRef}
              className="flex items-center justify-between text-[13px] text-neutral-700 will-change-transform"
            >
              <span className="font-normal text-neutral-600">Select Size</span>
              <span className="font-normal text-neutral-400">[EU]</span>
            </div>
          </div>

          <div className="overflow-hidden">
            <div ref={sizeGridRef} className="grid grid-cols-4 gap-1.5 will-change-transform">
              {displaySizes.map((item) => {
                const isSelected = selectedSize === item.size
                return (
                  <button
                    key={item.size}
                    type="button"
                    disabled={!item.inStock}
                    onClick={() => setSelectedSize(item.size)}
                    className={`h-10 text-[11px] font-medium rounded-[4px] border transition-all cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#18181A] text-white border-[#18181A]'
                        : item.inStock
                        ? 'bg-white text-neutral-800 border-neutral-200 hover:border-black'
                        : 'bg-white text-neutral-300 border-neutral-100 cursor-not-allowed opacity-50'
                    }`}
                  >
                    {item.size}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Add to Cart Action inside overflow-hidden clipping wrapper */}
        <div className="overflow-hidden pt-1">
          <div ref={cartBtnRef} className="will-change-transform">
            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full bg-[#18181A] hover:bg-black text-white h-11 rounded-[4px] font-normal text-[13.5px] tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
            >
              {isAdded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Added To Cart</span>
                </>
              ) : (
                <span>Add To Cart</span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ── 4. Center Column: Infinite Vertical Scrolling Image Stream ── */}
      <div
        ref={streamContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none"
      >
        <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
          {allImages.map((imgSrc, idx) => {
            const isHero = idx === heroIndex
            return (
              <div
                key={idx}
                ref={(el) => (itemRefs.current[idx] = el)}
                className="absolute flex items-center justify-center pointer-events-auto will-change-transform select-none"
                style={{
                  top: '50%',
                  left: '50%',
                }}
              >
                <img
                  ref={isHero ? heroImgRef : null}
                  src={imgSrc}
                  alt={`${shoe.name} view ${idx + 1}`}
                  className="max-h-[42vh] max-w-[55vw] lg:max-w-[500px] xl:max-w-[560px] aspect-[1200/875] object-contain pointer-events-none select-none block"
                  draggable={false}
                />
              </div>
            )
          })}
        </div>

        {/* Mobile Info Overlay Drawer / Bottom Bar for Small Devices */}
        <div className="flex lg:hidden fixed bottom-20 left-0 right-0 p-6 pointer-events-none z-30">
          <div className="w-full max-w-sm mx-auto bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-neutral-100 flex flex-col gap-3 pointer-events-auto">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-medium tracking-tight text-neutral-900 font-['PP_Neue_Montreal']">{shoe.name}</h1>
                <div className="text-sm font-normal text-neutral-500">{shoe.price}</div>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                className="bg-[#18181A] text-white px-4 py-2 rounded-[4px] text-xs font-normal"
              >
                {isAdded ? 'Added' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. Bottom-Left Subtle Scroll Hint (Equal Page Padding) ── */}
      <div
        ref={scrollHintRef}
        className="hidden lg:block fixed z-30 pointer-events-none will-change-transform left-6 md:left-8 lg:left-10 bottom-6 md:bottom-8 lg:bottom-10 select-none"
      >
        <span className="text-[12px] font-normal text-neutral-400 tracking-wider">
          Scroll
        </span>
      </div>

      {/* ── 6. Floating Minimal Dark Back Pill Control (Equal Page Padding) ── */}
      <div
        ref={backPillRef}
        className="fixed left-1/2 -translate-x-1/2 z-50 will-change-transform bottom-6 md:bottom-8 lg:bottom-10"
      >
        <button
          type="button"
          onClick={onClose}
          className="group inline-flex items-center gap-2 bg-[#18181A] hover:bg-black text-white px-5 py-2.5 rounded-full text-[13px] font-medium tracking-wide shadow-xl cursor-pointer select-none transition-all duration-200 hover:scale-105 active:scale-95"
          aria-label="Back to Interactive View"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-1" strokeWidth={2.2} />
          <span>Back</span>
        </button>
      </div>
    </div>
  )
})

export default ProductDetailView
