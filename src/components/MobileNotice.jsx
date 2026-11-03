import { useEffect } from 'react'

export default function MobileNotice() {
  useEffect(() => {
    // Prevent mobile viewport scrolling while notice is visible
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <main
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[10000] w-full h-[100dvh] bg-[#000000] text-white flex flex-col items-center justify-center p-8 text-center select-none overflow-hidden font-['PP_Neue_Montreal'] font-sans"
      style={{ backgroundColor: '#000000' }}
    >
      <div className="max-w-[360px] mx-auto flex flex-col items-center justify-center">
        {/* Subtle status pulse indicator */}
        <div className="w-2 h-2 rounded-full bg-red-500 mb-6 animate-pulse" />

        {/* Heading */}
        <h1 className="text-sm sm:text-base font-medium tracking-[0.2em] text-white uppercase mb-3 leading-snug">
          Development In Progress
        </h1>

        {/* Message */}
        <p className="text-[14.5px] sm:text-[15.5px] leading-relaxed text-neutral-400 font-normal mb-2">
          We're currently working on the mobile experience.
        </p>

        <p className="text-[13.5px] sm:text-[14.5px] leading-relaxed text-neutral-500 font-normal">
          For the best experience, please open this website on a desktop.
        </p>
      </div>
    </main>
  )
}

