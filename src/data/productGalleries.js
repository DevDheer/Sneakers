import green1 from '../assets/Green1.png'
import green2 from '../assets/Green2.png'
import green4 from '../assets/Green4.png'
import green5 from '../assets/Green5.png'
import grey1 from '../assets/Grey1.png'
import grey2 from '../assets/Grey2.png'
import grey4 from '../assets/Grey3.png'
import grey5 from '../assets/Grey4.png'
import black1 from '../assets/Black1.png'
import black2 from '../assets/Black2.png'
import black4 from '../assets/Black3.png'
import black5 from '../assets/Black4.png'
import blue1 from '../assets/Blue1.png'
import blue2 from '../assets/Blue2.png'
import blue4 from '../assets/Blue3.png'
import blue5 from '../assets/Blue4.png'
import brown1 from '../assets/Brown1.png'
import brown2 from '../assets/Brown2.png'
import brown4 from '../assets/Brown3.png'
import brown5 from '../assets/Brown4.png'
import sakura1 from '../assets/Sakura1.png'
import sakura2 from '../assets/Sakura2.png'
import sakura4 from '../assets/Sakura3.png'
import sakura5 from '../assets/Sakura4.png'
import speedtail1 from '../assets/Speadtail1.png'
import speedtail2 from '../assets/Speadtail2.png'
import speedtail4 from '../assets/Speadtail3.png'
import speedtail5 from '../assets/Speadtail4.png'

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
    above: [blue1, blue2],
    below: [blue4, blue5],
  },
  black: {
    above: [black1, black2],
    below: [black4, black5],
  },
  grey: {
    above: [grey1, grey2],
    below: [grey4, grey5],
  },
  brown: {
    above: [brown1, brown2],
    below: [brown4, brown5],
  },
  sakura: {
    above: [sakura1, sakura2],
    below: [sakura4, sakura5],
  },
  speedtail: {
    above: [speedtail1, speedtail2],
    below: [speedtail4, speedtail5],
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
