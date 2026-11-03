import logoImg from '../assets/Logo.png'

export default function Logo({ className = '' }) {
  return (
    <a
      href="#"
      className={`inline-flex items-center select-none group focus:outline-none ${className}`}
      aria-label="V5N Home"
    >
      <img
        src={logoImg}
        alt="V5N"
        className="h-7 sm:h-8 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
      />
    </a>
  )
}
