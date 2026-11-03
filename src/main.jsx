import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { Observer } from 'gsap/Observer'
import './styles/global.css'
import App from './App.jsx'

// Register GSAP plugins globally
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, Observer)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
