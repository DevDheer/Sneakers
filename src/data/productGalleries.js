import green1 from '../assets/Green1.png'
import green2 from '../assets/Green2.png'
import green4 from '../assets/Green4.png'
import green5 from '../assets/Green5.png'

/**
 * Product Gallery Images Repository
 *
 * Each sneaker ID maps to an image gallery structure.
 * Supports either:
 *   1. An object: { above: [image1, image2], below: [image4, image5] }
 *   2. A flat array: [image1, image2, image4, image5]
 *
 * Image slots:
 *   - above: 2 additional images arranged vertically ABOVE the central hero shoe
 *   - below: 2 additional images arranged vertically BELOW the central hero shoe
 *
 * In accordance with specifications:
 *   - Only authentic photos provided for that sneaker are used.
 *   - No fake placeholders, duplicate images, or unrelated sneaker photos.
 *   - Proportions are preserved without cropping.
 */

export const PRODUCT_GALLERIES = {
  green: {
    // 2 images above the central shoe:
    // green1: top-most shoe angle
    // green2: front view of pair with green toe caps
    above: [green1, green2],
    // 2 images below the central shoe:
    // green4: heel view of pair with red VSN embroidery
    // green5: bottom-most shoe angle
    below: [green4, green5],
  },
  blue: {
    above: [],
    below: [],
  },
  black: {
    above: [],
    below: [],
  },
  grey: {
    above: [],
    below: [],
  },
  brown: {
    above: [],
    below: [],
  },
  sakura: {
    above: [],
    below: [],
  },
  speedtail: {
    above: [],
    below: [],
  },
}

/**
 * Safely retrieve normalized gallery object for any sneaker ID
 * @param {string} shoeId
 * @returns {{ above: string[], below: string[] }}
 */
export function getProductGallery(shoeId) {
  const item = PRODUCT_GALLERIES[shoeId]
  if (!item) return { above: [], below: [] }

  if (Array.isArray(item)) {
    return {
      above: item.slice(0, 2),
      below: item.slice(2, 4),
    }
  }

  return {
    above: Array.isArray(item.above) ? item.above : [],
    below: Array.isArray(item.below) ? item.below : [],
  }
}
