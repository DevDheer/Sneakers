import { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'
import gsap from 'gsap'

// ── WebGL Shaders for Premium Liquid Lens Distortion ──
// Pure optical physics: cubic lens falloff, velocity-responsive stretch, and subtle chromatic dispersion.
// Zero sinusoidal waves, zero ripples, zero pulses.
// Draws the exact sneaker texture: when u_hover is 0.0, renders the 100% authentic untouched sneaker.
// When u_hover > 0.0, refracts pixels gently around the cursor apex.

const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute vec2 a_uv;
  varying vec2 v_uv;

  void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER_SOURCE = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  varying vec2 v_uv;
  uniform sampler2D u_texture;
  uniform vec2 u_mouse;       // Normalized cursor position [0, 1]
  uniform vec2 u_velocity;    // Normalized cursor velocity vector
  uniform float u_hover;      // Fade in/out factor: 0.0 to 1.0
  uniform float u_aspect;     // Canvas aspect ratio (width / height)
  uniform float u_strength;   // Maximum lens displacement strength
  uniform float u_radius;     // Local distortion radius

  void main() {
    vec2 uv = v_uv;

    if (u_hover > 0.001) {
      // Aspect-ratio correction to ensure circular lens geometry
      vec2 p = uv;
      p.x *= u_aspect;
      vec2 m = u_mouse;
      m.x *= u_aspect;

      float dist = distance(p, m);

      if (dist < u_radius) {
        // Smooth cubic Hermite falloff: 1.0 at cursor apex, smoothly reaching 0.0 at radius boundary
        float factor = smoothstep(u_radius, 0.0, dist) * u_hover;

        // Optical liquid glass refraction (gently bends light toward cursor apex)
        vec2 dir = normalize(p - m + vec2(0.0001));
        float lensDisplacement = factor * factor * (3.0 - 2.0 * factor) * u_strength;
        vec2 lensOffset = vec2(-dir.x / u_aspect, -dir.y) * lensDisplacement;

        // Velocity reaction: liquid lens stretches subtly in the direction of cursor motion
        vec2 velOffset = vec2(-u_velocity.x / u_aspect, -u_velocity.y) * factor * 0.020;

        vec2 totalOffset = lensOffset + velOffset;

        // Clamped sampling coordinates to guarantee sampling within texture bounds [0, 1]
        vec2 sampleUv = clamp(uv + totalOffset, vec2(0.0), vec2(1.0));
        vec2 sampleUvR = clamp(uv + totalOffset * 1.035, vec2(0.0), vec2(1.0));
        vec2 sampleUvB = clamp(uv + totalOffset * 0.965, vec2(0.0), vec2(1.0));

        // Sample base texture with chromatic dispersion
        vec4 colCenter = texture2D(u_texture, sampleUv);
        float r = texture2D(u_texture, sampleUvR).r;
        float g = colCenter.g;
        float b = texture2D(u_texture, sampleUvB).b;
        float a = colCenter.a;

        // Delicate specular reflection highlight along the glass crest (scaled by alpha so transparent areas stay clean)
        float highlight = pow(factor, 3.6) * 0.05 * u_hover * a;

        gl_FragColor = vec4(r + highlight, g + highlight, b + highlight, a);
      } else {
        gl_FragColor = texture2D(u_texture, uv);
      }
    } else {
      // Exactly authentic untouched original texture when not hovered or at rest
      gl_FragColor = texture2D(u_texture, uv);
    }
  }
`

function compileShader(gl, source, type) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compilation error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/**
 * LiquidLensCanvas — Independent, zero-drift WebGL Liquid Lens for each sneaker.
 *
 * Guaranteed Texture Lifecycle & Rendering:
 *   - StrictMode Immune: Safely cancels RAF and disposes GPU resources on unmount;
 *     resets initialization state so StrictMode remount re-creates fresh resources without deleted-object errors.
 *   - Initial State: Original image remains fully visible. WebGL canvas starts hidden.
 *   - Texture Upload: Creates texture once, binds to gl.TEXTURE0, verifies completion before upload.
 *   - First Frame Validation: Verifies gl.isTexture, executes render, checks gl.getError().
 *     Only after first valid frame succeeds does canvas become visible and original image hidden.
 *   - On Hover: Modifies shader uniforms and starts RAF. NEVER toggles original image visibility.
 *   - On Leave: Settle shader to rest, pause RAF, canvas REMAINS VISIBLE.
 *   - On Failure / Error: Immediately restores original fallback image to visible.
 */
const LiquidLensCanvas = forwardRef(function LiquidLensCanvas(
  { imageSrc, imgElement, containerElement, isDragging = false },
  ref
) {
  const canvasRef = useRef(null)
  const glRef = useRef(null)
  const programRef = useRef(null)
  const textureRef = useRef(null)
  const positionBufferRef = useRef(null)
  const uvBufferRef = useRef(null)

  // Status flags
  const isInitializedRef = useRef(false)
  const isDisposedRef = useRef(false)
  const isTextureUploadedRef = useRef(false)
  const isReadyRef = useRef(false) // True ONLY when texture is uploaded AND first valid frame rendered

  // Keep prop references fresh without triggering effect churn
  const imgElementRef = useRef(imgElement)
  imgElementRef.current = imgElement

  const containerElementRef = useRef(containerElement)
  containerElementRef.current = containerElement

  const uniformsRef = useRef({})
  const rafId = useRef(null)

  // Mouse tracking and velocity
  const mouseRef = useRef({
    x: 0.5,
    y: 0.5,
    targetX: 0.5,
    targetY: 0.5,
    velX: 0,
    velY: 0,
    targetVelX: 0,
    targetVelY: 0,
    lastX: 0.5,
    lastY: 0.5,
    lastTime: 0,
  })

  const hoverRef = useRef({ value: 0 })
  const isHoveredRef = useRef(false)

  // Helper to reliably find the companion DOM <img> element
  const getDomImage = useCallback(() => {
    if (imgElementRef.current && imgElementRef.current.naturalWidth > 0) {
      return imgElementRef.current
    }
    if (canvasRef.current?.parentElement) {
      const found = canvasRef.current.parentElement.querySelector('img')
      if (found) return found
    }
    return null
  }, [])

  // Restore fallback image immediately if WebGL fails
  const restoreFallbackImage = useCallback(() => {
    isReadyRef.current = false
    const img = getDomImage()
    if (img) {
      img.style.visibility = 'visible'
      img.style.opacity = '1'
    }
    if (canvasRef.current) {
      canvasRef.current.style.visibility = 'hidden'
      canvasRef.current.style.opacity = '0'
    }
  }, [getDomImage])

  // Safely switch visibility from fallback image to WebGL canvas once WebGL is 100% verified
  const activateWebGLVisibility = useCallback(() => {
    const img = getDomImage()
    const canvas = canvasRef.current
    if (!canvas || !img || isDisposedRef.current) return

    // Hide original image using visibility (layout dimensions preserved so container does not collapse)
    img.style.visibility = 'hidden'
    img.style.opacity = '0'

    // Make WebGL canvas visible
    canvas.style.visibility = 'visible'
    canvas.style.opacity = '1'
    isReadyRef.current = true
  }, [getDomImage])

  // ── 1. Resize Canvas to Match Exact Rendered Image Dimensions ──
  // The canvas must match the actual rendered <img> pixel dimensions (not the outer frame).
  // The outer imageFrame div is aspect-ratio locked but larger than the constrained <img>.
  // Matching the <img> ensures 1:1 UV mapping across the entire shoe, top to sole.
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const gl = glRef.current
    if (!canvas || !gl || isDisposedRef.current) return

    // Prefer the actual rendered <img> element dimensions for perfect UV alignment
    const img = imgElementRef.current || canvas.parentElement?.querySelector('img')
    const source = img || containerElementRef.current || canvas.parentElement
    if (!source) return

    const w = source.clientWidth || source.offsetWidth || 960
    const h = source.clientHeight || source.offsetHeight || 700
    if (w === 0 || h === 0) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pw = Math.round(w * dpr)
    const ph = Math.round(h * dpr)

    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
      gl.viewport(0, 0, pw, ph)
    }

    // Sync canvas CSS dimensions to match the rendered image exactly
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'

    // Center the canvas inside the parent frame using absolute positioning
    // so it overlays the image precisely even when the image is smaller than the frame
    const parent = canvas.parentElement
    if (parent) {
      const parentW = parent.clientWidth || parent.offsetWidth
      const parentH = parent.clientHeight || parent.offsetHeight
      const offsetLeft = Math.round((parentW - w) / 2)
      const offsetTop = Math.round((parentH - h) / 2)
      canvas.style.left = offsetLeft + 'px'
      canvas.style.top = offsetTop + 'px'
      canvas.style.right = 'auto'
      canvas.style.bottom = 'auto'
    }
  }, [])

  // ── 2. Render Single WebGL Frame ──
  const renderFrame = useCallback(() => {
    if (isDisposedRef.current) return false

    const gl = glRef.current
    const program = programRef.current
    const canvas = canvasRef.current
    const texture = textureRef.current

    // Safety checks: make sure resources are valid and alive
    if (!gl || !program || !canvas || !texture) return false
    if (!gl.isTexture(texture) || !gl.isProgram(program)) return false
    if (!isTextureUploadedRef.current) return false

    try {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.useProgram(program)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.uniform1i(uniformsRef.current.u_texture, 0)

      const m = mouseRef.current
      m.x += (m.targetX - m.x) * 0.16
      m.y += (m.targetY - m.y) * 0.16

      m.velX += (m.targetVelX - m.velX) * 0.18
      m.velY += (m.targetVelY - m.velY) * 0.18
      m.targetVelX *= 0.82
      m.targetVelY *= 0.82

      const aspect = canvas.width / (canvas.height || 1)

      gl.uniform2f(uniformsRef.current.u_mouse, m.x, m.y)
      gl.uniform2f(uniformsRef.current.u_velocity, m.velX, m.velY)
      gl.uniform1f(uniformsRef.current.u_hover, hoverRef.current.value)
      gl.uniform1f(uniformsRef.current.u_aspect, aspect)
      gl.uniform1f(uniformsRef.current.u_strength, 0.017)
      gl.uniform1f(uniformsRef.current.u_radius, 0.22)

      gl.drawArrays(gl.TRIANGLES, 0, 6)

      return gl.getError() === gl.NO_ERROR
    } catch (e) {
      console.error('Render frame exception:', e)
      return false
    }
  }, [])

  // ── 3. Upload Texture & Validate First Frame ──
  const uploadAndValidate = useCallback((sourceImage) => {
    if (isDisposedRef.current) return false

    const gl = glRef.current
    const texture = textureRef.current
    if (!gl || !texture) return false
    if (!gl.isTexture(texture)) {
      console.warn('uploadAndValidate: texture is not a valid WebGL texture')
      return false
    }

    if (!sourceImage || sourceImage.naturalWidth === 0 || sourceImage.naturalHeight === 0) {
      return false
    }

    try {
      // Bind to TEXTURE0 on TEXTURE_2D
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)

      // Upload texture data
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceImage)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

      if (gl.getError() !== gl.NO_ERROR) {
        console.error('WebGL texImage2D failed')
        return false
      }

      isTextureUploadedRef.current = true

      // Resize canvas to match layout
      resizeCanvas()

      // Render initial resting frame (u_hover = 0.0)
      const success = renderFrame()
      if (!success) {
        console.error('WebGL first frame validation failed')
        return false
      }

      // ALL CHECKS SUCCEEDED: Safely transition visibility to WebGL
      activateWebGLVisibility()
      return true
    } catch (err) {
      console.error('Texture upload error:', err)
      return false
    }
  }, [resizeCanvas, renderFrame, activateWebGLVisibility])

  // Helper to attempt texture upload from available image sources
  const attemptTextureInit = useCallback(() => {
    if (isDisposedRef.current || isReadyRef.current) return

    const domImg = getDomImage()
    if (domImg && domImg.complete && domImg.naturalWidth > 0) {
      const ok = uploadAndValidate(domImg)
      if (ok) return
    }

    if (domImg && !domImg.complete) {
      const onDomLoad = () => {
        if (!isDisposedRef.current && !isReadyRef.current) {
          uploadAndValidate(domImg)
        }
      }
      domImg.addEventListener('load', onDomLoad, { once: true })
    }

    // Fallback new Image()
    const fallback = new Image()
    fallback.crossOrigin = 'anonymous'
    fallback.onload = () => {
      if (!isDisposedRef.current && !isReadyRef.current) {
        uploadAndValidate(fallback)
      }
    }
    fallback.onerror = () => {
      if (!isDisposedRef.current) {
        console.warn('Fallback image load failed, original DOM image remains visible')
        restoreFallbackImage()
      }
    }
    fallback.src = imageSrc
  }, [imageSrc, getDomImage, uploadAndValidate, restoreFallbackImage])

  // ── 4. Animation Loop (Runs strictly while hover is active or settling) ──
  const startLoop = useCallback(() => {
    if (rafId.current || isDisposedRef.current) return

    const loop = () => {
      if (isDisposedRef.current) {
        rafId.current = null
        return
      }

      renderFrame()

      if (isHoveredRef.current || hoverRef.current.value > 0.001) {
        rafId.current = requestAnimationFrame(loop)
      } else {
        rafId.current = null
        // Settle at rest: render one clean unwarped frame and leave canvas VISIBLE
        renderFrame()
      }
    }
    rafId.current = requestAnimationFrame(loop)
  }, [renderFrame])

  // ── 5. Main WebGL Context & Resource Lifecycle (StrictMode Immune) ──
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isTouch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (isTouch) return

    const canvas = canvasRef.current
    if (!canvas) return

    isDisposedRef.current = false

    let gl = null
    try {
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
        powerPreference: 'high-performance',
      })
    } catch (e) {
      console.warn('WebGL context creation failed:', e)
      restoreFallbackImage()
      return
    }

    if (!gl) {
      console.warn('WebGL not supported, keeping original DOM image visible')
      restoreFallbackImage()
      return
    }

    isInitializedRef.current = true
    glRef.current = gl

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const vert = compileShader(gl, VERTEX_SHADER_SOURCE, gl.VERTEX_SHADER)
    const frag = compileShader(gl, FRAGMENT_SHADER_SOURCE, gl.FRAGMENT_SHADER)
    if (!vert || !frag) {
      restoreFallbackImage()
      return
    }

    const program = gl.createProgram()
    gl.attachShader(program, vert)
    gl.attachShader(program, frag)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking failed:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      restoreFallbackImage()
      return
    }
    programRef.current = program
    gl.useProgram(program)

    // Full quad geometry covering NDC [-1, 1]
    const positionBuffer = gl.createBuffer()
    positionBufferRef.current = positionBuffer
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    )
    const posAttr = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(posAttr)
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0)

    // UV coordinates covering [0, 1]
    const uvBuffer = gl.createBuffer()
    uvBufferRef.current = uvBuffer
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
      gl.STATIC_DRAW
    )
    const uvAttr = gl.getAttribLocation(program, 'a_uv')
    gl.enableVertexAttribArray(uvAttr)
    gl.vertexAttribPointer(uvAttr, 2, gl.FLOAT, false, 0, 0)

    // Uniform Locations
    uniformsRef.current = {
      u_texture: gl.getUniformLocation(program, 'u_texture'),
      u_mouse: gl.getUniformLocation(program, 'u_mouse'),
      u_velocity: gl.getUniformLocation(program, 'u_velocity'),
      u_hover: gl.getUniformLocation(program, 'u_hover'),
      u_aspect: gl.getUniformLocation(program, 'u_aspect'),
      u_strength: gl.getUniformLocation(program, 'u_strength'),
      u_radius: gl.getUniformLocation(program, 'u_radius'),
    }

    // Create texture ONCE
    const tex = gl.createTexture()
    textureRef.current = tex

    // Bind texture initially to TEXTURE0
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)

    // Initialize texture upload
    attemptTextureInit()

    // Handle context loss gracefully
    const handleContextLost = (e) => {
      e.preventDefault()
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
      restoreFallbackImage()
    }
    canvas.addEventListener('webglcontextlost', handleContextLost, false)

    // CLEANUP SEQUENCE:
    // 1. Mark disposed
    // 2. Cancel animation loop FIRST
    // 3. Kill GSAP tweens
    // 4. Remove event listeners
    // 5. Restore fallback image
    // 6. Delete GPU resources safely
    // 7. Reset refs so remount initializes cleanly
    return () => {
      isDisposedRef.current = true

      // 1. Cancel RAF immediately
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }

      // 2. Kill GSAP tweens
      gsap.killTweensOf(hoverRef.current)

      // 3. Remove listeners
      canvas.removeEventListener('webglcontextlost', handleContextLost)

      // 4. Restore original image before disposing
      restoreFallbackImage()

      // 5. Safely delete WebGL GPU objects
      if (gl) {
        if (textureRef.current && gl.isTexture(textureRef.current)) {
          gl.deleteTexture(textureRef.current)
        }
        if (positionBufferRef.current && gl.isBuffer(positionBufferRef.current)) {
          gl.deleteBuffer(positionBufferRef.current)
        }
        if (uvBufferRef.current && gl.isBuffer(uvBufferRef.current)) {
          gl.deleteBuffer(uvBufferRef.current)
        }
        if (programRef.current && gl.isProgram(programRef.current)) {
          gl.deleteProgram(programRef.current)
        }
      }

      // 6. Reset all refs
      textureRef.current = null
      programRef.current = null
      positionBufferRef.current = null
      uvBufferRef.current = null
      glRef.current = null
      isInitializedRef.current = false
      isReadyRef.current = false
      isTextureUploadedRef.current = false
    }
  }, [imageSrc, attemptTextureInit, restoreFallbackImage])

  // Re-check texture initialization when imgElement prop updates
  useEffect(() => {
    if (!isReadyRef.current && !isDisposedRef.current) {
      attemptTextureInit()
    }
  }, [imgElement, attemptTextureInit])

  // ── 6. Public API Exposed to Parent ──
  useImperativeHandle(ref, () => ({
    // ON HOVER: Activate shader uniforms and cursor distortion.
    // NEVER TOGGLES THE ORIGINAL IMAGE VISIBILITY!
    activate(u = 0.5, v = 0.5) {
      if (isDragging || isDisposedRef.current) return

      // If WebGL is not ready, original image is already visible. Never hide it!
      if (!isReadyRef.current) {
        attemptTextureInit()
        return
      }

      mouseRef.current.targetX = u
      mouseRef.current.targetY = v
      mouseRef.current.x = u
      mouseRef.current.y = v
      mouseRef.current.lastX = u
      mouseRef.current.lastY = v
      mouseRef.current.lastTime = performance.now()
      mouseRef.current.targetVelX = 0
      mouseRef.current.targetVelY = 0

      isHoveredRef.current = true
      gsap.killTweensOf(hoverRef.current)
      gsap.to(hoverRef.current, {
        value: 1,
        duration: 0.32,
        ease: 'power2.out',
      })

      startLoop()
    },

    // ON MOUSE MOVE: Update normalized cursor position and velocity
    updatePointer(u, v) {
      if (isDragging || isDisposedRef.current || !isReadyRef.current) return

      const now = performance.now()
      const dt = Math.max(1, now - mouseRef.current.lastTime)
      mouseRef.current.lastTime = now

      const rawVx = (u - mouseRef.current.lastX) / (dt * 0.001)
      const rawVy = (v - mouseRef.current.lastY) / (dt * 0.001)
      mouseRef.current.lastX = u
      mouseRef.current.lastY = v

      const maxV = 2.5
      mouseRef.current.targetVelX = Math.max(-maxV, Math.min(maxV, rawVx * 0.2))
      mouseRef.current.targetVelY = Math.max(-maxV, Math.min(maxV, rawVy * 0.2))

      mouseRef.current.targetX = u
      mouseRef.current.targetY = v

      if (!rafId.current) startLoop()
    },

    // ON MOUSE LEAVE: Smoothly return shader to normal appearance.
    // CANVAS REMAINS VISIBLE! ORIGINAL IMAGE REMAINS HIDDEN!
    deactivate() {
      if (isDisposedRef.current) return
      if (!isHoveredRef.current && hoverRef.current.value <= 0.001) return

      isHoveredRef.current = false
      gsap.killTweensOf(hoverRef.current)
      gsap.to(hoverRef.current, {
        value: 0,
        duration: 0.35,
        ease: 'power2.out',
        onComplete: () => {
          if (isDisposedRef.current) return
          // Render final static resting frame (unwarped sneaker)
          renderFrame()
          if (rafId.current) {
            cancelAnimationFrame(rafId.current)
            rafId.current = null
          }
        },
      })
    },

    // ON CAROUSEL DRAG START: Instantly return to resting appearance
    deactivateImmediately() {
      if (isDisposedRef.current) return
      isHoveredRef.current = false
      gsap.killTweensOf(hoverRef.current)
      hoverRef.current.value = 0
      if (isReadyRef.current) {
        renderFrame()
      }
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
    },

    resize() {
      if (isDisposedRef.current) return
      resizeCanvas()
      if (isReadyRef.current && !isHoveredRef.current) {
        renderFrame()
      }
    },

    isHovered() {
      return isHoveredRef.current
    },

    isReady() {
      return isReadyRef.current
    },
  }))

  // Cancel distortion when carousel drag begins
  useEffect(() => {
    if (isDragging) {
      isHoveredRef.current = false
      hoverRef.current.value = 0
      if (isReadyRef.current) {
        renderFrame()
      }
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
    }
  }, [isDragging, renderFrame])

  // Canvas starts HIDDEN with opacity 0 and visibility: hidden
  // Only becomes visible AFTER texture is loaded, rendered, and verified.
  // Width/height and position are set dynamically by resizeCanvas() to match the actual <img> exactly.
  return (
    <canvas
      ref={canvasRef}
      className="absolute pointer-events-none select-none block"
      style={{
        visibility: 'hidden',
        opacity: 0,
        zIndex: 10,
        transition: 'opacity 0.25s ease',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}
    />
  )
})

export default LiquidLensCanvas
