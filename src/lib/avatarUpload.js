import { supabase } from './supabase'

const MAX_SOURCE_BYTES = 10 * 1024 * 1024  // reject absurdly large files before we even try to decode them
const MAX_DIMENSION     = 400               // avatars are never displayed larger than this
const JPEG_QUALITY       = 0.85

/**
 * Read the EXIF Orientation tag (1–8) from a JPEG file, if present.
 * Needed because canvas drawImage() ignores EXIF rotation metadata — without
 * this, photos taken in portrait on a phone come out sideways after resizing.
 */
function getExifOrientation(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const view = new DataView(e.target.result)
        if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) return resolve(1)
        let offset = 2
        while (offset < view.byteLength - 4) {
          const marker = view.getUint16(offset, false)
          if (marker === 0xFFE1) {
            const exifStart = offset + 4
            if (view.getUint32(exifStart, false) !== 0x45786966) return resolve(1)  // "Exif"
            const tiffOffset = exifStart + 6
            const little = view.getUint16(tiffOffset, false) === 0x4949
            const firstIFDOffset = view.getUint32(tiffOffset + 4, little)
            const ifdStart = tiffOffset + firstIFDOffset
            const tagCount = view.getUint16(ifdStart, little)
            for (let i = 0; i < tagCount; i++) {
              const entryOffset = ifdStart + 2 + i * 12
              if (view.getUint16(entryOffset, little) === 0x0112) {  // Orientation tag
                return resolve(view.getUint16(entryOffset + 8, little))
              }
            }
            return resolve(1)
          }
          if ((marker & 0xFF00) !== 0xFF00) break
          offset += 2 + view.getUint16(offset + 2, false)
        }
      } catch { /* fall through to default orientation */ }
      resolve(1)
    }
    reader.onerror = () => resolve(1)
    reader.readAsArrayBuffer(file.slice(0, 128 * 1024))  // EXIF lives near the start of the file
  })
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image file')) }
    img.src = url
  })
}

// Canvas transform matrix per EXIF orientation value. `srcW`/`srcH` must be
// the RAW source image's own (unswapped) dimensions — not the output canvas
// dimensions, which are swapped for the 90°/270° cases (5–8). Verified against
// hand-derived corner mappings for all 8 orientations.
function applyOrientationTransform(ctx, orientation, srcW, srcH) {
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, srcW, 0); break
    case 3: ctx.transform(-1, 0, 0, -1, srcW, srcH); break
    case 4: ctx.transform(1, 0, 0, -1, 0, srcH); break
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break
    case 6: ctx.transform(0, 1, -1, 0, srcH, 0); break
    case 7: ctx.transform(0, -1, -1, 0, srcH, srcW); break
    case 8: ctx.transform(0, -1, 1, 0, 0, srcW); break
    default: break  // 1 = already upright
  }
}

/**
 * Correct EXIF rotation, crop to a centered square, downscale to
 * MAX_DIMENSION, and re-encode as JPEG — so every avatar is a consistent,
 * upright square regardless of the source photo's orientation or shape.
 */
async function resizeImage(file) {
  const [orientation, img] = await Promise.all([getExifOrientation(file), loadImage(file)])

  // Orientations 5–8 involve a 90°/270° rotation, which swaps width/height.
  const rotated = orientation >= 5 && orientation <= 8
  const uprightW = rotated ? img.height : img.width
  const uprightH = rotated ? img.width  : img.height

  // Step 1 — draw the source at full resolution, corrected for orientation.
  const upright = document.createElement('canvas')
  upright.width = uprightW
  upright.height = uprightH
  const uctx = upright.getContext('2d')
  applyOrientationTransform(uctx, orientation, img.width, img.height)
  uctx.drawImage(img, 0, 0)

  // Step 2 — crop a centered square from the upright image, scaled to the
  // final avatar size in one pass.
  const side = Math.min(uprightW, uprightH)
  const sx = (uprightW - side) / 2
  const sy = (uprightH - side) / 2

  const out = document.createElement('canvas')
  out.width = MAX_DIMENSION
  out.height = MAX_DIMENSION
  out.getContext('2d').drawImage(upright, sx, sy, side, side, 0, 0, MAX_DIMENSION, MAX_DIMENSION)

  return new Promise((resolve, reject) => {
    out.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not process that image')), 'image/jpeg', JPEG_QUALITY)
  })
}

/**
 * Resize, upload to the "avatars" bucket at `<userId>/avatar.jpg` (overwriting
 * any previous picture), and save the resulting URL on the user's profile.
 * Returns the new cache-busted avatar URL.
 */
export async function uploadAvatar(userId, file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('That image is too large (max 10 MB).')

  const blob = await resizeImage(file)
  const path = `${userId}/avatar.jpg`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })
  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
  const avatarUrl = `${publicUrl}?t=${Date.now()}`  // cache-bust: same path every time

  const { error: dbError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId)
  if (dbError) throw dbError

  return avatarUrl
}
