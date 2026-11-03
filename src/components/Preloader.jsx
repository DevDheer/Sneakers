import { useState, useEffect, useRef } from 'react'
import gsap from 'gsap'
import L1 from '../assets/L1.png'
import L2 from '../assets/L2.png'
import L3 from '../assets/L3.png'
import L4 from '../assets/L4.png'
import L5 from '../assets/L5.png'
import L6 from '../assets/L6.png'

const LOADER_IMAGES = [L1, L2, L3, L4, L5, L6]

export default function Preloader({ onExitStart, onExitComplete }) {
  const [activeImgIndex, setActiveImgIndex] = useState(0)
  const [isImagesLoaded, setIsImagesLoaded] = useState(false)

  const loaderRef = useRef(null)
  const numberRef = useRef(null)
  const intervalRef = useRef(null)
  const tlRef = useRef(null)
  const countProxyRef = useRef({ val: 100 })

  // ── 1. Preload all 4 images before starting animation ──
  useEffect(() => {
    let isMounted = true
    let loadedCount = 0

    LOADER_IMAGES.forEach((src) => {
      const img = new Image()
      img.src = src
      const handleLoad = () => {
        loadedCount++
        if (loadedCount >= LOADER_IMAGES.length && isMounted) {
          setIsImagesLoaded(true)
        }
      }
      if (img.complete) {
        handleLoad()
      } else {
        img.onload = handleLoad
        img.onerror = handleLoad
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  // ── 2. Run Sequence & Countdown Animations once images are preloaded ──
  useEffect(() => {
    if (!isImagesLoaded) return

    // Lock scrolling while loader is active
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    // Rapid continuous image sequence: 1 -> 2 -> 3 -> 4 -> 1 (every 120ms)
    intervalRef.current = setInterval(() => {
      setActiveImgIndex((prev) => (prev + 1) % LOADER_IMAGES.length)
    }, 70)

    const tl = gsap.timeline()
    tlRef.current = tl

    // ── Phase A: Smooth Countdown from 100 to 0 over ~3.5 seconds ──
    tl.to(countProxyRef.current, {
      val: 0,
      duration: 1.7,
      ease: 'power1.inOut',
      onUpdate: () => {
        if (numberRef.current) {
          numberRef.current.textContent = Math.round(countProxyRef.current.val)
        }
      },
      onComplete: () => {
        if (numberRef.current) {
          numberRef.current.textContent = '0'
        }
        // Stop rapid sequence playback when countdown hits zero
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      },
    })

    // ── Phase B: Number slides DOWN into overflow-hidden clipping container ──
    tl.to(
      numberRef.current,
      {
        yPercent: 115,
        duration: 0.35,
        ease: 'power3.in',
      },
      '+=0.04'
    )

    // ── Phase C: Pink loader moves upwards completely outside viewport ──
    tl.to(
      loaderRef.current,
      {
        yPercent: -100,
        duration: 0.95,
        ease: 'power3.inOut',
        onStart: () => {
          // Trigger website entrance animation as the loader begins moving upward
          onExitStart && onExitStart()
        },
        onComplete: () => {
          // Restore scrolling and unmount loader
          document.documentElement.style.overflow = ''
          document.body.style.overflow = ''
          onExitComplete && onExitComplete()
        },
      },
      '-=0.08' // Seamlessly overlaps slightly as number finishes tucking away
    )

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      tl.kill()
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [isImagesLoaded, onExitStart, onExitComplete])

  return (
    <aside
      aria-label="Loading screen"
      ref={loaderRef}
      className="fixed inset-0 z-[9999] w-full h-[100dvh] bg-[#FF5058] select-none pointer-events-auto overflow-hidden will-change-transform flex flex-col justify-between"
      style={{
        backgroundColor: '#FB3846',
      }}
    >
      {/* ── Centered Sneaker Frame: Exact 688x860 Aspect Ratio, Rapid Sequence ── */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] sm:w-[280px] md:w-[320px] lg:w-[350px] aspect-[688/860] max-h-[50vh] flex items-center justify-center select-none pointer-events-none">
        {LOADER_IMAGES.map((src, i) => (
          <img
            key={i}
            src={src}
            alt="Sneaker frame"
            className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
            style={{
              display: activeImgIndex === i ? 'block' : 'none',
            }}
          />
        ))}
      </div>

      {/* ── Bottom-Left Large White Countdown Number ── */}
      <div className="absolute left-6 md:left-10 lg:left-12 bottom-4 md:bottom-6 lg:bottom-8 select-none pointer-events-none">
        {/* Overflow-hidden clipping container for number slide-down exit */}
        <div className="overflow-hidden leading-none">
          <div
            ref={numberRef}
            className="text-white font-medium tracking-tight text-[110px] sm:text-[145px] md:text-[185px] lg:text-[230px] leading-[0.82] will-change-transform font-['PP_Neue_Montreal'] font-sans"
          >
            100
          </div>
        </div>
      </div>
    </aside>
  )
}

