import { useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { ChevronDown, Heart, User, ShoppingCart, X, Menu } from 'lucide-react'
import Logo from './Logo'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

const Header = forwardRef(function Header({ leftContent, skipInitialAnimation = false }, ref) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  const headerRef = useRef(null)
  const centerLogoRef = useRef(null)
  const navPillRef = useRef(null)

  // Calculate dynamic horizontal translation for the desktop logo from center to left
  const getLogoDeltaX = () => {
    if (!centerLogoRef.current) return 0
    const vw = window.innerWidth
    if (vw < 1024) return 0
    // In p-6 md:p-8 lg:p-10: padding on desktop (lg) is 40px
    const pad = vw >= 1024 ? 40 : 32
    const logoW = centerLogoRef.current.offsetWidth || 56
    // Logo in Header is centered at vw / 2. Target left position is pad + logoW / 2.
    return (pad + logoW / 2) - (vw / 2)
  }

  // Expose imperative methods for coordinated view transitions
  useImperativeHandle(ref, () => ({
    // Prepare Header prior to site entrance (subtle initial states without moving ProductInfo)
    prepareEntrance() {
      const targets = [centerLogoRef.current, navPillRef.current].filter(Boolean)
      gsap.killTweensOf(targets)
      if (centerLogoRef.current) {
        gsap.set(centerLogoRef.current, { scale: 0.92, opacity: 0 })
      }
      if (navPillRef.current) {
        gsap.set(navPillRef.current, { y: -10, opacity: 0 })
      }
      if (headerRef.current) {
        gsap.set(headerRef.current, { y: 0, opacity: 1 })
      }
    },

    // Animate Header in during site entrance
    animateIn(duration = 0.6) {
      const tl = gsap.timeline()
      if (centerLogoRef.current) {
        gsap.killTweensOf(centerLogoRef.current)
        tl.to(
          centerLogoRef.current,
          {
            scale: 1,
            opacity: 1,
            duration,
            ease: 'power3.out',
          },
          0
        )
      }
      if (navPillRef.current) {
        gsap.killTweensOf(navPillRef.current)
        tl.to(
          navPillRef.current,
          {
            y: 0,
            opacity: 1,
            duration,
            ease: 'power3.out',
          },
          0.04
        )
      }
      return tl
    },

    // Glide logo smoothly from center to left
    animateLogoToLeft() {
      if (!centerLogoRef.current) return null
      const dx = getLogoDeltaX()
      gsap.killTweensOf(centerLogoRef.current)
      return gsap.to(centerLogoRef.current, {
        x: dx,
        duration: 0.60,
        ease: 'power3.inOut',
      })
    },

    // Glide logo smoothly from left back to center (Phase 3)
    animateLogoToCenter() {
      if (!centerLogoRef.current) return null
      gsap.killTweensOf(centerLogoRef.current)
      return gsap.to(centerLogoRef.current, {
        x: 0,
        duration: 0.65,
        ease: 'power2.inOut',
      })
    },

    // Instantly reset logo to center
    resetLogo() {
      if (centerLogoRef.current) {
        gsap.killTweensOf(centerLogoRef.current)
        gsap.set(centerLogoRef.current, { x: 0 })
      }
    },

    // Instantly place logo at left edge (for starting return transition)
    setLogoAtLeft() {
      if (!centerLogoRef.current) return
      gsap.killTweensOf(centerLogoRef.current)
      gsap.set(centerLogoRef.current, { x: getLogoDeltaX() })
    },
  }))

  // Smooth entrance animation on initial page mount (unless preloader controls entrance)
  useGSAP(
    () => {
      if (skipInitialAnimation) {
        gsap.set(headerRef.current, { y: -18, opacity: 0 })
        return
      }
      gsap.from(headerRef.current, {
        y: -18,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
      })
    },
    { scope: headerRef, dependencies: [skipInitialAnimation] }
  )

  return (
    <header
      ref={headerRef}
      className="relative z-30 w-full"
    >
      <div className="w-full flex items-start justify-between">
        {/* Left column: Product Info aligned parallel to Logo & Nav */}
        <div className="flex-1 flex justify-start">
          {leftContent}
        </div>

        {/* Center column: Original V5N Logo with will-change-transform for FLIP transitions */}
        <div
          ref={centerLogoRef}
          className="hidden lg:flex absolute left-1/2 -translate-x-1/2 top-1.5 items-center justify-center pointer-events-auto will-change-transform"
        >
          <Logo />
        </div>

        {/* Right column: Navigation Bar */}
        <div className="flex-1 hidden md:flex justify-end items-start">
          <nav
            ref={navPillRef}
            aria-label="Main Navigation"
            className="bg-[#F6F6F6] px-8 py-3 flex items-center gap-8 text-[18px] font-normal text-neutral-800 select-none pointer-events-auto will-change-transform"
          >
            {/* Collections Link */}
            <a
              href="#collections"
              className="flex items-center gap-2 hover:text-black transition-colors"
            >
              <span>Collections</span>
              <ChevronDown
                className="w-4 h-4 text-neutral-800"
                strokeWidth={2.2}
              />
            </a>

            {/* About Link */}
            <a
              href="#about"
              className="hover:text-black transition-colors"
            >
              About
            </a>

            {/* Wishlist Icon */}
            <button
              type="button"
              onClick={() => setIsWishlisted((prev) => !prev)}
              className="flex items-center justify-center hover:text-black transition-colors focus:outline-none cursor-pointer"
              aria-label="Wishlist"
              title="Add to Wishlist"
            >
              <Heart
                className={`w-[18px] h-[18px] transition-colors ${
                  isWishlisted
                    ? 'fill-red-500 text-red-500'
                    : 'text-neutral-800 hover:text-black'
                }`}
                strokeWidth={2.2}
              />
            </button>

            {/* Profile Icon */}
            <button
              type="button"
              className="flex items-center justify-center text-neutral-800 hover:text-black transition-colors focus:outline-none cursor-pointer"
              aria-label="Account"
              title="Account"
            >
              <User className="w-[18px] h-[18px]" strokeWidth={2.2} />
            </button>

            {/* Shopping Cart Icon (with count badge) */}
            <button
              type="button"
              onClick={() => setCartCount((prev) => prev + 1)}
              className="relative flex items-center justify-center text-neutral-800 hover:text-black transition-colors focus:outline-none cursor-pointer"
              aria-label={`Cart (${cartCount} items)`}
              title="Shopping Cart"
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

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-2 pointer-events-auto">
          <div className="mr-2">
            <Logo />
          </div>
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
            className="p-2 text-neutral-800 hover:text-black"
            aria-label="Toggle navigation"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden mt-3 p-4 bg-[#F6F6F6] flex flex-col gap-3 border border-neutral-200 pointer-events-auto">
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
    </header>
  )
})

export default Header
