import { useState, useEffect, useRef, useCallback } from 'react'
import { flushSync } from 'react-dom'
import Header from './components/Header'
import ProductInfo from './components/ProductInfo'
import ShoeShowcase from './components/ShoeShowcase'
import BottomControls from './components/BottomControls'
import GridView from './components/GridView'
import ProductDetailView from './components/ProductDetailView'
import Preloader from './components/Preloader'
import MobileNotice from './components/MobileNotice'
import { SHOES } from './data/shoes'
import gsap from 'gsap'
import { Observer } from 'gsap/Observer'

function App() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768
    }
    return false
  })
  const [isLoaderActive, setIsLoaderActive] = useState(true)
  const [currentShoeId, setCurrentShoeId] = useState('green')
  const [activeThumbnail, setActiveThumbnail] = useState(0)
  const [isGridMode, setIsGridMode] = useState(false)
  const [isDetailMode, setIsDetailMode] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('green')

  const currentShoeIdRef = useRef('green')
  const headerRef         = useRef(null)
  const showcaseRef       = useRef(null)
  const productInfoRef    = useRef(null)
  const bottomControlsRef = useRef(null)
  const gridViewRef       = useRef(null)
  const productDetailRef  = useRef(null)
  const heroLayerRef      = useRef(null)

  const isTransitioningRef    = useRef(true)
  const transitionTimelineRef = useRef(null)

  const carouselProxyRef = useRef({ progress: 0 })
  const isDraggingRef    = useRef(false)
  const dragTweenRef     = useRef(null)
  const observerRef      = useRef(null)

  // Current active shoe in Interactive View
  const currentIndex = SHOES.findIndex((s) => s.id === currentShoeId)
  const currentShoe  = SHOES[currentIndex] || SHOES[0]

  // Currently selected shoe for Product Detail View
  const selectedShoe = SHOES.find((s) => s.id === selectedProductId) || currentShoe

  // Preload all shoe images on mount
  useEffect(() => {
    SHOES.forEach(({ image }) => {
      const img = new Image()
      img.src = image
    })
  }, [])

  // ── Responsive Screen Handling (768px Breakpoint) ──
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ── Prepare initial website elements below clipping boundaries while Preloader is active ──
  useEffect(() => {
    if (isLoaderActive && !isMobile) {
      showcaseRef.current?.prepareSiteEntrance()
      productInfoRef.current?.prepareTextEntrance(currentShoe)
      bottomControlsRef.current?.prepareEntrance(currentShoe)
      headerRef.current?.prepareEntrance()
    }
  }, [isLoaderActive, isMobile, currentShoe])

  // ── Preloader Exit: Coordinated Cinematic Desktop Entrance Timeline ──
  const handleLoaderExitStart = useCallback(() => {
    const tl = gsap.timeline()

    // 1. Five sneaker images pop into orbital positions with center-out stagger
    tl.add(() => {
      showcaseRef.current?.animateSiteEntrance()
    }, 0.05)

    // 2. Editorial headings, descriptions, and price emerge upward out of clipping lines
    tl.add(() => {
      productInfoRef.current?.animateTextIn(0.65)
      bottomControlsRef.current?.animateTextIn(0.65)
    }, 0.08)

    // 3. Navbar, logo, and interactive controls reveal smoothly with subtle scale & opacity
    tl.add(() => {
      headerRef.current?.animateIn(0.60)
      bottomControlsRef.current?.popIn(0.60)
    }, 0.12)
  }, [])

  const handleLoaderExitComplete = useCallback(() => {
    setIsLoaderActive(false)
    isTransitioningRef.current = false
  }, [])

  // ── Instant Active Shoe Notification ──
  const handleShoeChange = (shoe) => {
    if (!shoe || isGridMode || isDetailMode || isLoaderActive || isMobile) return
    productInfoRef.current?.transitionTo(shoe)
    bottomControlsRef.current?.transitionTo(shoe)
    if (shoe.id !== currentShoeIdRef.current) {
      currentShoeIdRef.current = shoe.id
      setCurrentShoeId(shoe.id)
    }
  }

  // ── Shortest-Path Circular Navigation ──
  const scrollToShoe = useCallback((shoeId) => {
    const targetIdx = SHOES.findIndex((s) => s.id === shoeId)
    if (targetIdx === -1) return

    isDraggingRef.current = false
    dragTweenRef.current?.kill()

    const currentP = carouselProxyRef.current.progress
    const total    = SHOES.length

    let diff = (targetIdx - (currentP % total)) % total
    if (diff < -total / 2) diff += total
    if (diff > total / 2)  diff -= total

    const targetProgress = currentP + diff

    gsap.to(carouselProxyRef.current, {
      progress: targetProgress,
      duration: 0.75,
      ease: 'power3.inOut',
      overwrite: 'auto',
      onUpdate: () => {
        showcaseRef.current?.updateProgress(carouselProxyRef.current.progress)
      },
    })
  }, [])

  // ── Drag Callbacks ──
  const handleDragStart = () => {
    isDraggingRef.current = true
    dragTweenRef.current?.kill()
    dragTweenRef.current = null
    gsap.killTweensOf(carouselProxyRef.current)
  }

  const handleDragProgress = (newProgress) => {
    carouselProxyRef.current.progress = newProgress
  }

  const handleDragEnd = (snapProgress, currentP) => {
    const distance = Math.abs(snapProgress - currentP)
    const duration = Math.min(0.85, Math.max(0.38, distance * 0.48))

    dragTweenRef.current?.kill()
    dragTweenRef.current = gsap.to(carouselProxyRef.current, {
      progress: snapProgress,
      duration,
      ease: 'power3.out',
      onUpdate: () => {
        showcaseRef.current?.updateProgress(carouselProxyRef.current.progress)
      },
      onComplete: () => {
        isDraggingRef.current = false
        dragTweenRef.current  = null
      },
    })
  }

  // ── Keyboard Navigation ──
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isGridMode || isDetailMode || isLoaderActive || isTransitioningRef.current) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const snapTarget = Math.round(carouselProxyRef.current.progress) + 1
        handleDragEnd(snapTarget, carouselProxyRef.current.progress)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const snapTarget = Math.round(carouselProxyRef.current.progress) - 1
        handleDragEnd(snapTarget, carouselProxyRef.current.progress)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isGridMode, isDetailMode, isLoaderActive])

  // ── Wheel / Touch Scroll Observer ──
  useEffect(() => {
    // Restore carousel to the saved progress (preserves selected sneaker across view transitions)
    showcaseRef.current?.updateProgress(carouselProxyRef.current.progress)
    let snapTimer = null

    // Kill previous observer before creating a new one
    observerRef.current?.kill()

    if (isGridMode || isDetailMode || isLoaderActive) return

    const obs = Observer.create({
      target: window,
      type: 'wheel,touch,pointer',
      wheelSpeed: -1,
      tolerance: 10,
      preventDefault: false,
      onWheel: (self) => {
        if (isDraggingRef.current || isGridMode || isDetailMode || isLoaderActive || isTransitioningRef.current) return
        const delta   = self.deltaY * 0.0024
        const targetP = carouselProxyRef.current.progress + delta

        gsap.killTweensOf(carouselProxyRef.current)
        gsap.to(carouselProxyRef.current, {
          progress: targetP,
          duration: 0.35,
          ease: 'power2.out',
          overwrite: 'auto',
          onUpdate: () => {
            showcaseRef.current?.updateProgress(carouselProxyRef.current.progress)
          },
        })

        clearTimeout(snapTimer)
        snapTimer = setTimeout(() => {
          if (isDraggingRef.current || isGridMode || isDetailMode || isLoaderActive) return
          const snapTarget = Math.round(carouselProxyRef.current.progress)
          gsap.to(carouselProxyRef.current, {
            progress: snapTarget,
            duration: 0.45,
            ease: 'power3.out',
            onUpdate: () => {
              showcaseRef.current?.updateProgress(carouselProxyRef.current.progress)
            },
          })
        }, 180)
      },
    })

    observerRef.current = obs

    return () => {
      obs.kill()
      clearTimeout(snapTimer)
    }
  }, [isGridMode, isDetailMode, isLoaderActive])

  // ──────────────────────────────────────────────────────────────────
  //  PRODUCT DETAIL VIEW TRANSITIONS (FLIP SNEAKER TRANSFORMATION)
  // ──────────────────────────────────────────────────────────────────

  // Interactive View → Product Detail View
  const handleOpenDetailView = useCallback((targetShoeId) => {
    if (isTransitioningRef.current || isGridMode || isDetailMode) return
    isTransitioningRef.current = true

    // Pause scroll observer
    observerRef.current?.kill()
    transitionTimelineRef.current?.kill()

    const chosenId = (typeof targetShoeId === 'string' && targetShoeId) ? targetShoeId : currentShoeIdRef.current

    // Save the selected sneaker's ID and snap carousel progress to its exact index
    // so that on return, the carousel restores the correct position
    const chosenIndex = SHOES.findIndex((s) => s.id === chosenId)
    if (chosenIndex !== -1) {
      carouselProxyRef.current.progress = chosenIndex
    }

    // Update currentShoeId to match the selected product so it persists on return
    currentShoeIdRef.current = chosenId
    setCurrentShoeId(chosenId)
    setSelectedProductId(chosenId)

    // Synchronously ensure ProductDetailView has the selected shoe
    flushSync(() => {
      setSelectedProductId(chosenId)
    })

    // Elevate hero layer so transforming sneaker and gliding logo remain on top of white background
    if (heroLayerRef.current) {
      heroLayerRef.current.style.zIndex = '60'
      heroLayerRef.current.style.visibility = 'visible'
      heroLayerRef.current.style.pointerEvents = 'none'
    }

    // 1. Prepare Product Detail View initial state (hidden behind, text below clipping boundary)
    productDetailRef.current?.prepareEntrance()

    // 2. Measure the exact target rect where the hero image sits in ProductDetailView
    const targetRect = productDetailRef.current?.getHeroRect()

    const tl = gsap.timeline({
      onComplete: () => {
        if (heroLayerRef.current) {
          heroLayerRef.current.style.zIndex = ''
        }
        isTransitioningRef.current = false
      },
    })
    transitionTimelineRef.current = tl

    // ── Phase 1 (0.0s): Current interactive view text moves down into clipping boundary ──
    tl.add(() => {
      productInfoRef.current?.animateTextOut()
      bottomControlsRef.current?.animateTextOut()
      bottomControlsRef.current?.popOut()
    }, 0)

    // ── Phase 2 (0.02s): Clicked sneaker transforms smoothly to flat presentation; Logo glides to left ──
    tl.add(() => {
      showcaseRef.current?.animateShoeToDetail(chosenId, targetRect)
      headerRef.current?.animateLogoToLeft()
    }, 0.02)

    // ── Phase 3 (0.22s): Reveal pure white detail background and start text entrance ──
    tl.add(() => {
      productDetailRef.current?.showImmediately()
      productDetailRef.current?.animateIn()
    }, 0.22)

    // ── Phase 4 (0.62s): Sneaker reaches exact destination — handoff to ProductDetailView ──
    tl.add(() => {
      productDetailRef.current?.setHeroImageVisible(true)
      productDetailRef.current?.setLogoVisible(true)
      showcaseRef.current?.hideShoeWrapper(chosenId)
      if (heroLayerRef.current) {
        heroLayerRef.current.style.visibility = 'hidden'
        heroLayerRef.current.style.pointerEvents = 'none'
        heroLayerRef.current.style.zIndex = ''
      }
      flushSync(() => {
        setIsDetailMode(true)
      })
    }, 0.62)
  }, [isGridMode, isDetailMode])

  // Product Detail View → Interactive View (Back Control) — 3-Phase Sequential Rebuild
  const handleCloseDetailView = useCallback(() => {
    if (isTransitioningRef.current || !isDetailMode) return
    isTransitioningRef.current = true

    transitionTimelineRef.current?.kill()

    const targetRect = productDetailRef.current?.getHeroRect()
    const chosenId = selectedProductId

    // Sync currentShoeId to the selected product so Interactive View restores the correct sneaker
    currentShoeIdRef.current = chosenId
    const chosenIndex = SHOES.findIndex((s) => s.id === chosenId)
    if (chosenIndex !== -1) {
      carouselProxyRef.current.progress = chosenIndex
    }
    setCurrentShoeId(chosenId)

    // Calculate exact on-screen position and scale of the detail hero shoe
    const vw = window.innerWidth
    const vh = window.innerHeight
    const rect = targetRect || {
      left: vw * 0.25,
      top: vh * 0.2,
      width: Math.min(vw * 0.5, 680),
      height: Math.min(vh * 0.52, 480),
    }
    const targetCenterX = rect.left + rect.width / 2
    const targetCenterY = rect.top + rect.height / 2
    const startX = targetCenterX - vw / 2
    const startY = targetCenterY - vh / 2

    const showcaseWidth = Math.min(vw * 0.85, 960)
    const currentScale = Math.min(1.0, Math.max(0.48, (rect.width || 680) / showcaseWidth))

    // 1. Immediately elevate heroLayer on top so the returning shoe is smoothly visible
    if (heroLayerRef.current) {
      heroLayerRef.current.style.visibility = 'visible'
      heroLayerRef.current.style.zIndex = '60'
      heroLayerRef.current.style.pointerEvents = 'none'
    }

    // Hand off hero image to showcase shoe wrapper at this exact spot and scale
    showcaseRef.current?.showShoeWrapper(chosenId, startX, startY, currentScale)
    productDetailRef.current?.setHeroImageVisible(false)

    // Position Header logo at left to match Detail View before gliding back
    headerRef.current?.setLogoAtLeft()
    productDetailRef.current?.setLogoVisible(false)

    const activeShoe = SHOES.find((s) => s.id === chosenId) || currentShoe

    const tl = gsap.timeline({
      onComplete: () => {
        productDetailRef.current?.hideImmediately()
        if (heroLayerRef.current) {
          heroLayerRef.current.style.zIndex = ''
          heroLayerRef.current.style.pointerEvents = 'auto'
        }
        headerRef.current?.resetLogo()
        showcaseRef.current?.reset()
        flushSync(() => {
          setIsDetailMode(false)
        })
        isTransitioningRef.current = false
      },
    })
    transitionTimelineRef.current = tl

    // ══════════════════════════════════════════════════════════════════
    // PHASE ONE (0.00s – 0.45s): Product Detail View Exits
    // ══════════════════════════════════════════════════════════════════
    // 1. Detail text moves DOWN inside overflow-hidden wrappers (0.35s, power3.in).
    // 2. Product images pop out (scale 1 -> 0.85, opacity 1 -> 0, 0.40s, power2.in).
    // 3. Back pill & scroll hint pop out. Detail white bg dissolves.
    tl.add(() => {
      productDetailRef.current?.animateOut()
    }, 0)

    // 4. Central sneaker begins return transformation during this phase:
    // Starts moving towards original orbital position, gradually reduces scale,
    // rotates back towards original tilt (-8deg).
    tl.add(() => {
      showcaseRef.current?.animateShoeFromDetail(chosenId)
    }, 0)

    // ══════════════════════════════════════════════════════════════════
    // PHASE TWO (0.45s – 0.55s): Complete Product Detail Exit
    // ══════════════════════════════════════════════════════════════════
    // Ensure all detail elements have completely disappeared before Interactive View enters.
    // Absolute zero overlap!
    tl.add(() => {
      productDetailRef.current?.hideImmediately()
      if (heroLayerRef.current) {
        heroLayerRef.current.style.zIndex = ''
      }
      showcaseRef.current?.prepareOrbitalEntrance(chosenId)
      productInfoRef.current?.prepareTextEntrance(activeShoe)
      bottomControlsRef.current?.prepareEntrance(activeShoe)
    }, 0.50)

    // ══════════════════════════════════════════════════════════════════
    // PHASE THREE (0.55s – 1.35s): Interactive View Enters
    // ══════════════════════════════════════════════════════════════════
    // 1. Five sneaker images appear with center sneaker first, then surrounding
    // sneakers staggered by ~0.07s (0.65s, power3.out).
    // Header logo glides from left back to center (0.65s, power2.inOut).
    tl.add(() => {
      showcaseRef.current?.restoreOrbitalSneakers(chosenId)
      headerRef.current?.animateLogoToCenter()
    }, 0.55)

    // 2. Interactive View text emerges UP inside clipping lines (y: 110% -> 0%, 0.55s, power3.out).
    // Starts approx 0.12s after sneaker entrance begins (around 0.67s).
    // Bottom controls pop in (scale: 0.88 -> 1, opacity: 0 -> 1, 0.55s, power3.out).
    tl.add(() => {
      productInfoRef.current?.animateTextIn(0.55)
      bottomControlsRef.current?.animateTextIn(0.55)
      bottomControlsRef.current?.popIn(0.55)
    }, 0.67)
  }, [isDetailMode, selectedProductId, currentShoe])

  // ──────────────────────────────────────────────────────────────────
  //  GRID VIEW TRANSITIONS
  // ──────────────────────────────────────────────────────────────────

  // Interactive View → Grid View
  const handleOpenGridView = useCallback(() => {
    if (isTransitioningRef.current || isGridMode || isDetailMode) return
    isTransitioningRef.current = true

    observerRef.current?.kill()
    transitionTimelineRef.current?.kill()

    const tl = gsap.timeline({
      onComplete: () => {
        isTransitioningRef.current = false
      },
    })
    transitionTimelineRef.current = tl

    // ── 1. Current text moves down and disappears inside clipping line ──
    tl.add(() => {
      productInfoRef.current?.animateTextOut()
      bottomControlsRef.current?.animateTextOut()
    }, 0)

    // ── 2. Current images/controls pop out ──
    tl.add(() => {
      showcaseRef.current?.popOut()
      bottomControlsRef.current?.popOut()
    }, 0.04)

    // ── 3. Switch active view after exit animation completes (~0.34s) ──
    tl.add(() => {
      gridViewRef.current?.prepareEntrance()

      if (heroLayerRef.current) {
        heroLayerRef.current.style.visibility = 'hidden'
        heroLayerRef.current.style.pointerEvents = 'none'
      }
      gridViewRef.current?.showImmediately()

      flushSync(() => {
        setIsGridMode(true)
      })
    }, 0.34)

    // ── 4. New product cards pop into position ──
    tl.add(() => {
      gridViewRef.current?.popIn()
    }, 0.36)

    // ── 5. New text moves upward out of clipping lines ──
    tl.add(() => {
      gridViewRef.current?.animateTextIn()
    }, 0.42)
  }, [isGridMode, isDetailMode])

  // Grid View → Interactive View
  const handleCloseGridView = useCallback((targetShoeId) => {
    if (isTransitioningRef.current || !isGridMode) return
    isTransitioningRef.current = true

    transitionTimelineRef.current?.kill()

    const tl = gsap.timeline({
      onComplete: () => {
        isTransitioningRef.current = false
      },
    })
    transitionTimelineRef.current = tl

    // ── 1. Current text moves down inside clipping lines ──
    tl.add(() => {
      gridViewRef.current?.animateTextOut()
    }, 0)

    // ── 2. Current cards move downward and pop out ──
    tl.add(() => {
      gridViewRef.current?.popOut()
    }, 0.04)

    // ── 3. Switch active view after exit animation completes (~0.34s) ──
    tl.add(() => {
      const activeShoe = targetShoeId
        ? SHOES.find((s) => s.id === targetShoeId) || currentShoe
        : currentShoe

      showcaseRef.current?.prepareEntrance()
      productInfoRef.current?.prepareTextEntrance(activeShoe)
      bottomControlsRef.current?.prepareEntrance(activeShoe)

      if (targetShoeId) {
        scrollToShoe(targetShoeId)
        setActiveThumbnail(0)
      }

      gridViewRef.current?.hideImmediately()
      if (heroLayerRef.current) {
        heroLayerRef.current.style.visibility = 'visible'
        heroLayerRef.current.style.pointerEvents = 'auto'
      }

      flushSync(() => {
        setIsGridMode(false)
      })
    }, 0.34)

    // ── 4. New sneaker images pop into orbital positions ──
    tl.add(() => {
      showcaseRef.current?.popIn()
      bottomControlsRef.current?.popIn()
    }, 0.36)

    // ── 5. New text moves upward out of clipping lines ──
    tl.add(() => {
      productInfoRef.current?.animateTextIn()
      bottomControlsRef.current?.animateTextIn()
    }, 0.42)
  }, [isGridMode, currentShoe, scrollToShoe])

  // Clicking a grid card: navigate to that shoe and return to Interactive View
  const handleGridSelectShoe = useCallback((shoeId) => {
    handleCloseGridView(shoeId)
  }, [handleCloseGridView])

  // ── Mobile Screen Handling: Dedicated black development notice for < 768px ──
  if (isMobile) {
    return <MobileNotice />
  }

  return (
    <div className="relative w-full h-[100dvh] bg-[#FDFDFD] text-neutral-900 font-sans antialiased selection:bg-[#EE3135] selection:text-white overflow-hidden">

      {/* ── Interactive Hero Layer ── */}
      <div
        ref={heroLayerRef}
        className="h-full w-full flex flex-col justify-between p-6 md:p-8 lg:p-10 overflow-hidden relative"
        style={{
          visibility: (isGridMode || isDetailMode) ? 'hidden' : 'visible',
          pointerEvents: (isGridMode || isDetailMode) ? 'none' : 'auto',
        }}
      >
        {/* Header */}
        <Header
          ref={headerRef}
          skipInitialAnimation={isLoaderActive}
          leftContent={
            <ProductInfo
              ref={productInfoRef}
              shoe={currentShoe}
            />
          }
        />

        {/* Carousel — Clicking any shoe in Interactive View opens its dedicated Product Detail View */}
        <ShoeShowcase
          ref={showcaseRef}
          shoes={SHOES}
          onSelectShoe={handleOpenDetailView}
          onDragStart={handleDragStart}
          onDragProgress={handleDragProgress}
          onDragEnd={handleDragEnd}
          onShoeChange={handleShoeChange}
        />

        {/* Bottom bar */}
        <div className="relative w-full z-30">
          <BottomControls
            ref={bottomControlsRef}
            currentShoe={currentShoe}
            onOpenGridView={handleOpenGridView}
            activeThumbnail={activeThumbnail}
            onSelectThumbnail={setActiveThumbnail}
            isGridMode={isGridMode}
          />
        </div>
      </div>

      {/* ── Grid View ── */}
      <GridView
        ref={gridViewRef}
        shoes={SHOES}
        isOpen={isGridMode}
        onExit={() => handleCloseGridView()}
        onSelectShoe={handleGridSelectShoe}
      />

      {/* ── Product Detail View ── */}
      <ProductDetailView
        ref={productDetailRef}
        shoe={selectedShoe}
        isOpen={isDetailMode}
        onClose={handleCloseDetailView}
      />

      {/* ── Full-Screen Coral Pink Preloader ── */}
      {isLoaderActive && (
        <Preloader
          onExitStart={handleLoaderExitStart}
          onExitComplete={handleLoaderExitComplete}
        />
      )}
    </div>
  )
}

export default App
