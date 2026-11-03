import { useRef, useImperativeHandle, forwardRef, useEffect, useState, useCallback } from 'react'
import gsap from 'gsap'
import LiquidLensCanvas from './LiquidLensCanvas'

// Continuous mathematical curve calculation for the orbital carousel track
function getOrbitalTransform(u, vw, vh) {
  const isMobile = vw < 768
  const isTablet = vw >= 768 && vw < 1024
  const absU = Math.abs(u)
  const sign = u >= 0 ? 1 : -1

  // Horizontal Radius (Rx)
  const rx1 = isMobile ? 0.74 : isTablet ? 0.58 : 0.50
  const rx2 = isMobile ? 1.40 : isTablet ? 1.14 : 1.02

  let x = 0
  if (absU <= 1) {
    x = sign * absU * rx1 * vw
  } else {
    const excess = absU - 1
    x = sign * (rx1 + excess * (rx2 - rx1)) * vw
  }

  // Vertical Radius (Ry) & Diagonal Elevation
  const ry1 = isMobile ? 0.17 : isTablet ? 0.20 : 0.22
  const ry2 = isMobile ? 0.34 : isTablet ? 0.40 : 0.44
  let y = 0
  if (absU <= 1) {
    y = -sign * absU * ry1 * vh
  } else {
    const excess = absU - 1
    y = -sign * (ry1 + excess * (ry2 - ry1)) * vh
  }

  // Subtle orbital arch (curvature) for a 3D orbital feeling
  y += -Math.pow(u, 2) * (isMobile ? 7 : 14)

  // Scale: 1.0 at center, ~0.70 at u = +/-1, ~0.48 at u = +/-2
  const centerScale = isMobile ? 0.88 : 1.0
  let scale = 1.0
  if (absU <= 1) {
    scale = 1.0 - 0.30 * Math.pow(absU, 1.2)
  } else {
    scale = 0.70 - 0.22 * Math.min(1, Math.pow(absU - 1, 0.9))
  }
  scale = Math.max(0.35, scale * centerScale)

  // Rotation: -8deg resting center angle with gentle tilt along orbit
  const rotation = -8 - u * 2.0

  // Opacity: 1.0 at center, 0.92 at +/-1, drops to 0 at |u| >= 2.0 (ensuring invisible wrapping at u = +/-2.5)
  let opacity = 1.0
  if (absU <= 1) {
    opacity = 1.0 - absU * 0.08
  } else if (absU <= 1.8) {
    opacity = 0.92 - (absU - 1) * 0.75
  } else {
    opacity = Math.max(0, 0.32 - (absU - 1.8) * 1.6)
  }

  const zIndex = Math.max(1, Math.round(30 - absU * 10))

  return { x, y, scale, rotation, opacity, zIndex }
}

const ShoeShowcase = forwardRef(function ShoeShowcase(
  { shoes, onSelectShoe, onDragStart, onDragProgress, onDragEnd, onShoeChange },
  ref
) {
  const containerRef = useRef(null)
  const shoeWrapperRefs = useRef([])      // Outer wrappers: strictly orbital GSAP coordinates
  const magneticWrapperRefs = useRef([])  // Inner wrappers: strictly magnetic cursor coordinates
  const imageFrameRefs = useRef([])       // Exact image frames: locked 1200/875 aspect ratio
  const imgRefs = useRef([])              // Original high-res <img> elements
  const quickToRefs = useRef([])          // Pre-allocated GSAP quickTo pipes for 60fps magnetic tracking
  const currentTransformsRef = useRef([]) // Cached shoe coordinates to eliminate getBoundingClientRect reflows
  const currentMagOffsetsRef = useRef(shoes.map(() => ({ x: 0, y: 0, rot: 0 }))) // Track magnetic offsets
  const lensCanvasRefs = useRef([])       // Independent LiquidLensCanvas refs for each sneaker

  const lastProgressRef = useRef(0)
  const [activeCenterIndex, setActiveCenterIndex] = useState(0)
  const activeCenterIndexRef = useRef(0)

  // Drag interaction states & refs
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const hasCapturedPointerRef = useRef(false)
  const clickedShoeIdRef = useRef(null)
  const dragStartClientX = useRef(0)
  const dragStartProgress = useRef(0)
  const lastMoveX = useRef(0)
  const lastMoveTime = useRef(0)
  const velocityX = useRef(0)
  const totalDragDistance = useRef(0)
  const rafId = useRef(null)

  // Pre-initialize GSAP quickTo pipes for each sneaker's inner wrapper
  useEffect(() => {
    quickToRefs.current = shoes.map((_, i) => {
      const el = magneticWrapperRefs.current[i]
      if (!el) return null
      return {
        x: gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' }),
        y: gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' }),
        rot: gsap.quickTo(el, 'rotation', { duration: 0.45, ease: 'power3.out' }),
      }
    })
  }, [shoes])

  // Expose imperative method to update carousel positions across infinite progress
  useImperativeHandle(ref, () => ({
    updateProgress(progress) {
      lastProgressRef.current = progress
      if (!containerRef.current) return

      const vw = window.innerWidth
      const vh = window.innerHeight
      const total = shoes.length

      // ── 1. Calculate active center shoe by absolute distance from center ──
      let minAbsU = Infinity
      let closestIndex = 0

      shoes.forEach((_, i) => {
        let diff = (i - (progress % total)) % total
        if (diff < -total / 2) diff += total
        if (diff > total / 2) diff -= total
        const absU = Math.abs(diff)

        if (absU < minAbsU) {
          minAbsU = absU
          closestIndex = i
        }
      })

      // Immediate notification to text & price listeners the moment closest shoe changes
      if (closestIndex !== activeCenterIndexRef.current) {
        activeCenterIndexRef.current = closestIndex
        setActiveCenterIndex(closestIndex)
        onShoeChange && onShoeChange(shoes[closestIndex])
      }

      // ── 2. Update all 5 sneakers on the continuous orbital curve ──
      shoes.forEach((_, i) => {
        const outerEl = shoeWrapperRefs.current[i]
        if (!outerEl) return

        let diff = (i - (progress % total)) % total
        if (diff < -total / 2) diff += total
        if (diff > total / 2) diff -= total
        const u = diff

        const transform = getOrbitalTransform(u, vw, vh)
        currentTransformsRef.current[i] = transform

        // Transform ONLY the outer wrapper to avoid interfering with magnetic offsets
        gsap.set(outerEl, {
          x: transform.x,
          y: transform.y,
          scale: transform.scale,
          rotation: transform.rotation,
          opacity: transform.opacity,
          zIndex: transform.zIndex,
          transformOrigin: 'center center',
          force3D: true,
        })
      })
    },
    // View transition: pop out sneakers with subtle scale-down and opacity
    popOut() {
      if (!containerRef.current) return
      gsap.killTweensOf(containerRef.current)
      return gsap.to(containerRef.current, {
        scale: 0.88,
        opacity: 0,
        duration: 0.32,
        ease: 'power2.in',
      })
    },
    // View transition: prepare sneakers below scale prior to entrance
    prepareEntrance() {
      if (!containerRef.current) return
      gsap.killTweensOf(containerRef.current)
      gsap.set(containerRef.current, { scale: 0.88, opacity: 0 })
    },
    // View transition: pop in sneakers to original orbital layout
    popIn() {
      if (!containerRef.current) return
      gsap.killTweensOf(containerRef.current)
      return gsap.to(containerRef.current, {
        scale: 1,
        opacity: 1,
        duration: 0.45,
        ease: 'power3.out',
      })
    },
    // Reset to normal state
    reset() {
      if (!containerRef.current) return
      gsap.killTweensOf(containerRef.current)
      gsap.set(containerRef.current, { scale: 1, opacity: 1 })
    },
    // ── Physical FLIP Transformation to Product Detail View ──
    animateShoeToDetail(shoeId, targetRect) {
      if (!containerRef.current) return null
      const targetIndex = shoes.findIndex((s) => s.id === shoeId)
      if (targetIndex === -1) return null

      const activeEl = shoeWrapperRefs.current[targetIndex]
      const otherEls = shoeWrapperRefs.current.filter((_, idx) => idx !== targetIndex)

      // Deactivate liquid lens and reset magnetic pulls immediately
      lensCanvasRefs.current.forEach((lens) => lens?.deactivateImmediately?.())
      resetMagnetic()

      // Calculate target delta relative to viewport center (Showcase coordinate space)
      const vw = window.innerWidth
      const vh = window.innerHeight

      const imgEl = imgRefs.current[targetIndex]
      const frameEl = imageFrameRefs.current[targetIndex]
      const currentWidth = (imgEl?.offsetWidth || frameEl?.offsetWidth || Math.min(vw * 0.85, 960))

      const rect = targetRect || {
        left: vw * 0.25,
        top: vh * 0.20,
        width: Math.min(vw * 0.5, 680),
        height: Math.min(vh * 0.52, 480),
      }
      const targetCenterX = rect.left + rect.width / 2
      const targetCenterY = rect.top + rect.height / 2
      const targetX = targetCenterX - vw / 2
      const targetY = targetCenterY - vh / 2

      // Calculate target scale: shoe smoothly scales down simultaneously with rotation!
      const targetWidth = rect.width > 50 ? rect.width : Math.min(vw * 0.5, 680)
      const targetScale = Math.min(1.0, Math.max(0.48, targetWidth / currentWidth))

      // Kill tweens on all wrappers
      gsap.killTweensOf([activeEl, ...otherEls])

      const tl = gsap.timeline()

      // 1. Other sneakers fade out and scale down out of the way
      tl.to(
        otherEls,
        {
          opacity: 0,
          scale: 0.82,
          duration: 0.32,
          ease: 'power2.in',
        },
        0
      )

      // 2. Clicked sneaker transforms smoothly:
      // - Glides from orbital position to the detail hero position
      // - Gradually removes existing tilt/rotation into flat presentation (rotation: 0)
      // - SIMULTANEOUSLY scales down to targetScale so rotation and scaling happen together!
      // - Sets zIndex high to stay prominent
      tl.to(
        activeEl,
        {
          x: targetX,
          y: targetY,
          rotation: 0,
          scale: targetScale,
          opacity: 1,
          zIndex: 60,
          duration: 0.60,
          ease: 'power3.inOut',
        },
        0
      )

      return tl
    },
    // ── Phase 1: Physical FLIP Return of Central Sneaker towards Orbit ──
    animateShoeFromDetail(shoeId) {
      if (!containerRef.current) return null
      const targetIndex = shoes.findIndex((s) => s.id === shoeId)
      if (targetIndex === -1) return null

      const activeEl = shoeWrapperRefs.current[targetIndex]
      const vw = window.innerWidth
      const vh = window.innerHeight
      const total = shoes.length

      // Recompute original orbital transform for the active shoe
      let diff = (targetIndex - (lastProgressRef.current % total)) % total
      if (diff < -total / 2) diff += total
      if (diff > total / 2) diff -= total
      const activeTrans = getOrbitalTransform(diff, vw, vh)

      gsap.killTweensOf(shoeWrapperRefs.current)

      // Ensure all other sneakers remain completely hidden during Detail View exit
      shoes.forEach((_, idx) => {
        if (idx !== targetIndex && shoeWrapperRefs.current[idx]) {
          gsap.set(shoeWrapperRefs.current[idx], { opacity: 0 })
        }
      })

      const tl = gsap.timeline()

      // Central sneaker:
      // - Starts moving towards original Interactive View position (activeTrans.x, activeTrans.y)
      // - Gradually reduces scale towards original orbital scale
      // - Begins rotating back towards original orbital angle (-8deg)
      // - Smooth, controlled movement; does not disappear
      tl.to(
        activeEl,
        {
          x: activeTrans.x,
          y: activeTrans.y,
          rotation: activeTrans.rotation,
          scale: activeTrans.scale,
          opacity: activeTrans.opacity,
          zIndex: activeTrans.zIndex,
          duration: 0.52,
          ease: 'power3.inOut',
        },
        0
      )

      return tl
    },

    // ── Preloader / Initial Website Entrance ──
    prepareSiteEntrance() {
      if (!containerRef.current) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const total = shoes.length
      const progress = lastProgressRef.current

      shoes.forEach((_, idx) => {
        const el = shoeWrapperRefs.current[idx]
        if (!el) return

        let diff = (idx - (progress % total)) % total
        if (diff < -total / 2) diff += total
        if (diff > total / 2) diff -= total
        const t = getOrbitalTransform(diff, vw, vh)

        gsap.killTweensOf(el)
        gsap.set(el, {
          x: t.x,
          y: t.y,
          rotation: t.rotation,
          scale: t.scale * 0.88,
          opacity: 0,
          zIndex: t.zIndex,
        })
      })
    },

    animateSiteEntrance() {
      if (!containerRef.current) return null
      const vw = window.innerWidth
      const vh = window.innerHeight
      const total = shoes.length
      const progress = lastProgressRef.current

      gsap.killTweensOf(shoeWrapperRefs.current)

      const shoeData = shoes.map((shoe, idx) => {
        let diff = (idx - (progress % total)) % total
        if (diff < -total / 2) diff += total
        if (diff > total / 2) diff -= total
        const absU = Math.abs(diff)
        const transform = getOrbitalTransform(diff, vw, vh)
        return {
          index: idx,
          id: shoe.id,
          absU,
          transform,
          el: shoeWrapperRefs.current[idx],
        }
      })

      const tl = gsap.timeline()

      shoeData.forEach((item) => {
        if (!item.el) return
        const t = item.transform
        if (t.opacity <= 0.01) {
          gsap.set(item.el, { ...t, opacity: 0 })
          return
        }

        // Distance tier: center shoe first, then flanking pair (+0.08s), then outer pair (+0.16s)
        const tier = Math.round(item.absU)
        const delay = tier * 0.08

        gsap.set(item.el, {
          x: t.x,
          y: t.y,
          rotation: t.rotation,
          scale: t.scale * 0.88,
          opacity: 0,
          zIndex: t.zIndex,
        })

        tl.to(
          item.el,
          {
            scale: t.scale,
            opacity: t.opacity,
            duration: 0.65,
            ease: 'power3.out',
          },
          delay
        )
      })

      return tl
    },

    // ── Phase 2: Prepare Orbital Coordinates and Scale Prior to Phase 3 ──
    prepareOrbitalEntrance(chosenId) {
      if (!containerRef.current) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const total = shoes.length
      const progress = lastProgressRef.current

      shoes.forEach((shoe, idx) => {
        if (shoe.id === chosenId) return
        const el = shoeWrapperRefs.current[idx]
        if (!el) return

        let diff = (idx - (progress % total)) % total
        if (diff < -total / 2) diff += total
        if (diff > total / 2) diff -= total
        const t = getOrbitalTransform(diff, vw, vh)

        gsap.killTweensOf(el)
        gsap.set(el, {
          x: t.x,
          y: t.y,
          rotation: t.rotation,
          scale: t.scale * 0.88,
          opacity: 0,
          zIndex: t.zIndex,
        })
      })
    },

    // ── Phase 3: Staggered Entrance of 5 Orbital Sneakers (Center First) ──
    restoreOrbitalSneakers(chosenId) {
      if (!containerRef.current) return null
      const vw = window.innerWidth
      const vh = window.innerHeight
      const total = shoes.length
      const progress = lastProgressRef.current

      gsap.killTweensOf(shoeWrapperRefs.current)

      // Calculate transforms and distance tier for each sneaker
      const shoeData = shoes.map((shoe, idx) => {
        let diff = (idx - (progress % total)) % total
        if (diff < -total / 2) diff += total
        if (diff > total / 2) diff -= total
        const absU = Math.abs(diff)
        const transform = getOrbitalTransform(diff, vw, vh)
        return {
          index: idx,
          id: shoe.id,
          absU,
          transform,
          el: shoeWrapperRefs.current[idx],
        }
      })

      const tl = gsap.timeline()

      shoeData.forEach((item) => {
        if (!item.el) return
        const t = item.transform
        if (t.opacity <= 0.01) {
          gsap.set(item.el, { ...t, opacity: 0 })
          return
        }

        // Distance tier: 0 for center shoe, 1 for immediate flanking pair, 2 for outer visible pair
        // Creates a subtle ~0.07s stagger wave with the centre sneaker appearing first
        const tier = Math.round(item.absU)
        const delay = tier * 0.07

        if (item.id === chosenId || item.absU < 0.25) {
          // Centre shoe settles smoothly into its exact resting orbital state
          tl.to(
            item.el,
            {
              x: t.x,
              y: t.y,
              rotation: t.rotation,
              scale: t.scale,
              opacity: t.opacity,
              zIndex: t.zIndex,
              duration: 0.65,
              ease: 'power3.out',
            },
            delay
          )
        } else {
          // Surrounding sneakers animate from scale 0.88 and opacity 0 to exact orbital layout
          gsap.set(item.el, {
            x: t.x,
            y: t.y,
            rotation: t.rotation,
            scale: t.scale * 0.88,
            opacity: 0,
            zIndex: t.zIndex,
          })
          tl.to(
            item.el,
            {
              scale: t.scale,
              opacity: t.opacity,
              duration: 0.65,
              ease: 'power3.out',
            },
            delay
          )
        }
      })

      return tl
    },
    // Instantly hide the active shoe wrapper when handoff completes
    hideShoeWrapper(shoeId) {
      const idx = shoes.findIndex((s) => s.id === shoeId)
      if (idx !== -1 && shoeWrapperRefs.current[idx]) {
        gsap.set(shoeWrapperRefs.current[idx], { opacity: 0 })
      }
    },
    // Instantly show the active shoe wrapper when handoff begins
    showShoeWrapper(shoeId, x, y, scale) {
      const idx = shoes.findIndex((s) => s.id === shoeId)
      if (idx !== -1 && shoeWrapperRefs.current[idx]) {
        gsap.set(shoeWrapperRefs.current[idx], {
          x,
          y,
          rotation: 0,
          scale: scale !== undefined ? scale : 0.70,
          opacity: 1,
          zIndex: 60,
        })
      }
    },
  }))

  // ── Calculate True Image-Local UV Coordinates [0, 1] for Any Sneaker ──
  // Mathematically un-rotates and un-scales screen coordinates to match the shoe image plane
  const calculateShoeUV = useCallback((index, clientX, clientY) => {
    const frame = imageFrameRefs.current[index]
    const transform = currentTransformsRef.current[index]
    const mag = currentMagOffsetsRef.current[index] || { x: 0, y: 0, rot: 0 }

    if (!frame || !transform) return { u: 0.5, v: 0.5, inside: false }

    const vw = window.innerWidth
    const vh = window.innerHeight

    // Exact analytical shoe center on screen (zero DOM reflows)
    const shoeCenterX = vw / 2 + transform.x + mag.x
    const shoeCenterY = vh / 2 + transform.y + mag.y

    const dx = clientX - shoeCenterX
    const dy = clientY - shoeCenterY

    // Total rotation angle (orbital tilt + magnetic tilt) in radians
    const totalRot = transform.rotation + mag.rot
    const rad = (-totalRot * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const scale = transform.scale || 1.0

    // Un-rotate and un-scale
    const localX = (dx * cos - dy * sin) / scale
    const localY = (dx * sin + dy * cos) / scale

    const w = frame.clientWidth || 960
    const h = frame.clientHeight || 700

    // Normalised texture UV [0, 1] (WebGL v=0 at bottom, v=1 at top)
    const u = localX / w + 0.5
    const v = 0.5 - localY / h

    // Detect if cursor is inside visible sneaker image bounds
    const inside = u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0

    return {
      u: Math.max(0, Math.min(1, u)),
      v: Math.max(0, Math.min(1, v)),
      inside,
    }
  }, [])

  // ── Rebuilt & Optimised Distance-Based Magnetic Cursor Interaction ──
  const updateMagnetic = (clientX, clientY) => {
    if (isDraggingRef.current) return
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const vw = window.innerWidth
    const vh = window.innerHeight
    const maxOffset = 40
    const proximityRadius = 450

    shoes.forEach((_, i) => {
      const pipes = quickToRefs.current[i]
      const transform = currentTransformsRef.current[i]
      if (!pipes || !transform) return

      const shoeCenterX = vw / 2 + transform.x
      const shoeCenterY = vh / 2 + transform.y

      const dx = clientX - shoeCenterX
      const dy = clientY - shoeCenterY
      const dist = Math.hypot(dx, dy)

      if (dist < proximityRadius && dist > 1) {
        const t = 1 - dist / proximityRadius
        const strength = Math.pow(t, 1.4)
        const targetX = (dx / dist) * maxOffset * strength
        const targetY = (dy / dist) * maxOffset * strength
        const targetRot = (dx / proximityRadius) * 3.2 * strength

        currentMagOffsetsRef.current[i] = { x: targetX, y: targetY, rot: targetRot }

        pipes.x(targetX)
        pipes.y(targetY)
        pipes.rot(targetRot)
      } else {
        currentMagOffsetsRef.current[i] = { x: 0, y: 0, rot: 0 }
        pipes.x(0)
        pipes.y(0)
        pipes.rot(0)
      }
    })

    // Continuous pointer update for any currently active liquid lens canvas
    shoes.forEach((_, i) => {
      const lens = lensCanvasRefs.current[i]
      if (lens && lens.isHovered()) {
        const uv = calculateShoeUV(i, clientX, clientY)
        if (uv.inside) {
          lens.updatePointer(uv.u, uv.v)
        } else {
          lens.deactivate()
        }
      }
    })
  }

  // Smoothly reset all magnetic offsets and deactive any active lenses
  const resetMagnetic = () => {
    shoes.forEach((_, i) => {
      const pipes = quickToRefs.current[i]
      if (pipes) {
        pipes.x(0)
        pipes.y(0)
        pipes.rot(0)
      }
      currentMagOffsetsRef.current[i] = { x: 0, y: 0, rot: 0 }
    })
    lensCanvasRefs.current.forEach((lens) => lens?.deactivate())
  }

  // Window-level mouse tracking (throttled to native display refresh via rAF)
  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      if (isDraggingRef.current) return
      if (rafId.current) return
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null
        updateMagnetic(e.clientX, e.clientY)
      })
    }

    const handleWindowMouseLeave = () => {
      resetMagnetic()
    }

    window.addEventListener('mousemove', handleWindowMouseMove, { passive: true })
    document.addEventListener('mouseleave', handleWindowMouseLeave)

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      document.removeEventListener('mouseleave', handleWindowMouseLeave)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [shoes, calculateShoeUV])

  // Handle window resize dynamically to recompute responsive radii & canvas sizes
  useEffect(() => {
    const handleResize = () => {
      if (ref && 'current' in ref && ref.current?.updateProgress) {
        ref.current.updateProgress(lastProgressRef.current)
      }
      lensCanvasRefs.current.forEach((lens) => lens?.resize())
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [ref])

  // ── Pointer Handlers per Sneaker (Supports All 5 Shoes Independently) ──
  const handleShoePointerEnter = (index, e) => {
    if (isDraggingRef.current) return
    const uv = calculateShoeUV(index, e.clientX, e.clientY)
    lensCanvasRefs.current[index]?.activate(uv.u, uv.v)
  }

  const handleShoePointerMove = (index, e) => {
    if (isDraggingRef.current) return
    const uv = calculateShoeUV(index, e.clientX, e.clientY)

    if (uv.inside) {
      if (!lensCanvasRefs.current[index]?.isHovered()) {
        lensCanvasRefs.current[index]?.activate(uv.u, uv.v)
      } else {
        lensCanvasRefs.current[index]?.updatePointer(uv.u, uv.v)
      }
    } else {
      if (lensCanvasRefs.current[index]?.isHovered()) {
        lensCanvasRefs.current[index]?.deactivate()
      }
    }
  }

  const handleShoePointerLeave = (index) => {
    lensCanvasRefs.current[index]?.deactivate()
  }

  // ── Drag Interaction with Infinite Modular Navigation ──
  const handlePointerDown = (e) => {
    if (e.target.closest('button')) return

    // Immediately record which shoe was clicked/pressed
    const shoeEl = e.target.closest('[data-shoe-id]')
    clickedShoeIdRef.current = shoeEl ? shoeEl.getAttribute('data-shoe-id') : null
    hasCapturedPointerRef.current = false

    isDraggingRef.current = true
    setIsDragging(false) // Only set visual grabbing once drag distance threshold is reached
    resetMagnetic()
    lensCanvasRefs.current.forEach((lens) => lens?.deactivateImmediately?.())

    const clientX = e.clientX || e.touches?.[0]?.clientX || 0
    dragStartClientX.current = clientX
    lastMoveX.current = clientX
    lastMoveTime.current = performance.now()
    velocityX.current = 0
    totalDragDistance.current = 0
    dragStartProgress.current = lastProgressRef.current

    onDragStart && onDragStart()
  }

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return

    const clientX = e.clientX || e.touches?.[0]?.clientX || 0
    const now = performance.now()
    const dt = now - lastMoveTime.current

    if (dt > 10) {
      velocityX.current = (clientX - lastMoveX.current) / dt
      lastMoveX.current = clientX
      lastMoveTime.current = now
    }

    const deltaX = clientX - dragStartClientX.current
    totalDragDistance.current = Math.abs(deltaX)

    // Only capture pointer and enter grabbing state once the user actually drags (> 4px)
    if (totalDragDistance.current > 4) {
      if (!hasCapturedPointerRef.current) {
        hasCapturedPointerRef.current = true
        setIsDragging(true)
        try {
          e.currentTarget?.setPointerCapture(e.pointerId)
        } catch {}
      }

      // Unclamped continuous progress mapping — enables infinite drag in both directions
      const pxPerStage = window.innerWidth * 0.44
      const newProgress = dragStartProgress.current - deltaX / pxPerStage

      ref && ref.current?.updateProgress(newProgress)
      onDragProgress && onDragProgress(newProgress)
    }
  }

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return

    isDraggingRef.current = false
    setIsDragging(false)

    if (hasCapturedPointerRef.current) {
      hasCapturedPointerRef.current = false
      try {
        e.currentTarget?.releasePointerCapture(e.pointerId)
      } catch {}
    }

    // Check if this was a quick tap/click rather than a drag (< 8px movement)
    if (totalDragDistance.current < 8) {
      const targetShoeId =
        clickedShoeIdRef.current ||
        e.target.closest('[data-shoe-id]')?.getAttribute('data-shoe-id') ||
        shoes[activeCenterIndexRef.current]?.id

      clickedShoeIdRef.current = null

      if (targetShoeId) {
        onSelectShoe && onSelectShoe(targetShoeId)
      }
      return
    }

    clickedShoeIdRef.current = null

    // Natural momentum calculation and snapping to nearest integer stage
    const v = velocityX.current
    const pxPerStage = window.innerWidth * 0.44
    const momentumOffset = -(v * 180) / pxPerStage
    const snapProgress = Math.round(lastProgressRef.current + momentumOffset)

    onDragEnd && onDragEnd(snapProgress, lastProgressRef.current)
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => resetMagnetic()}
      className={`absolute inset-0 flex items-center justify-center select-none overflow-visible z-10 touch-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        touchAction: 'pan-y',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        willChange: 'transform, opacity',
      }}
    >
      {/* 5-Sneaker Infinite Orbital Carousel Stage */}
      <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
        {shoes.map((shoe, index) => {
          return (
            <div
              key={shoe.id}
              data-shoe-id={shoe.id}
              ref={(el) => (shoeWrapperRefs.current[index] = el)}
              className="absolute flex items-center justify-center pointer-events-auto"
              style={{
                willChange: 'transform, opacity',
              }}
              title={shoe.name}
            >
              {/* Inner Magnetic Wrapper: handles magnetic cursor attraction & spring-like return */}
              <div
                ref={(el) => (magneticWrapperRefs.current[index] = el)}
                className="relative flex items-center justify-center select-none"
                style={{
                  willChange: 'transform',
                }}
              >
                {/*
                  Image Frame: Locked 1200/875 aspect ratio.
                  Houses the original <img> and its dedicated LiquidLensCanvas.
                  Listens to pointer events directly to support independent hover on all 5 sneakers.
                */}
                <div
                  ref={(el) => (imageFrameRefs.current[index] = el)}
                  onPointerEnter={(e) => handleShoePointerEnter(index, e)}
                  onPointerMove={(e) => handleShoePointerMove(index, e)}
                  onPointerLeave={() => handleShoePointerLeave(index)}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (totalDragDistance.current < 8) {
                      onSelectShoe && onSelectShoe(shoe.id)
                    }
                  }}
                  className="relative flex items-center justify-center aspect-[1200/875] pointer-events-auto cursor-pointer"
                >
                  {/*
                    Original sneaker image:
                    Acts as the initial visible image and fail-safe fallback.
                    Only hidden via visibility: hidden after WebGL is verified ready and rendering.
                    If WebGL fails, this image immediately becomes visible.
                    GUARANTEE: Exactly ONE visible sneaker image at all times!
                  */}
                  <img
                    ref={(el) => { imgRefs.current[index] = el }}
                    src={shoe.image}
                    alt={shoe.name}
                    className="w-auto h-auto max-h-[64vh] sm:max-h-[70vh] lg:max-h-[78vh] xl:max-h-[82vh] max-w-[85vw] lg:max-w-[960px] xl:max-w-[1060px] aspect-[1200/875] object-contain pointer-events-none select-none block"
                    draggable={false}
                    style={{ visibility: 'visible', opacity: 1, transition: 'opacity 0.25s ease' }}
                  />

                  {/*
                    Independent WebGL Liquid Lens Canvas:
                    Permanently attached to this shoe's DOM frame.
                    ZERO reparenting, ZERO context loss, ZERO image duplication.
                  */}
                  <LiquidLensCanvas
                    ref={(el) => (lensCanvasRefs.current[index] = el)}
                    imageSrc={shoe.image}
                    imgElement={imgRefs.current[index]}
                    containerElement={imageFrameRefs.current[index]}
                    isDragging={isDragging}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default ShoeShowcase
