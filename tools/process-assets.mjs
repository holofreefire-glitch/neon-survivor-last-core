/**
 * Asset pipeline: converts raw AI-generated art (sprites on solid black)
 * into production game assets.
 *
 * - Sprites: alpha is derived from pixel luminance (black -> transparent),
 *   colors are un-premultiplied so neon glow composites correctly over any
 *   dark background. Output: trimmed, resized, transparent PNG.
 * - Backgrounds: resized to 1920x1080 and compressed to WebP.
 *
 * Usage: node tools/process-assets.mjs
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const RAW = 'assets_raw'
const OUT = 'public/assets/images'

const SPRITES = [
  { file: 'player_core.png', size: 256 },
  { file: 'enemy_glitch_bug.png', size: 128 },
  { file: 'enemy_dark_cube.png', size: 128 },
  { file: 'enemy_energy_drone.png', size: 128 },
  { file: 'enemy_virus_blob.png', size: 128 },
  { file: 'enemy_spike_mite.png', size: 128 },
  { file: 'enemy_phantom_ray.png', size: 128 },
  { file: 'enemy_data_wasp.png', size: 128 },
  { file: 'enemy_null_shard.png', size: 128 },
  { file: 'enemy_spark_eel.png', size: 128 },
  { file: 'enemy_byte_crab.png', size: 128 },
  { file: 'enemy_pixel_moth.png', size: 128 },
  { file: 'boss_firewall_golem.png', size: 512 },
  { file: 'boss_trojan_knight.png', size: 512 },
  { file: 'boss_hive_mind.png', size: 512 },
  { file: 'boss_void_serpent.png', size: 512 },
  { file: 'boss_omega_core.png', size: 512 },
  { file: 'icon_energy.png', size: 128 },
  { file: 'icon_crystal.png', size: 128 },
  { file: 'icon_heart.png', size: 128 },
  { file: 'pickup_energy_orb.png', size: 96 },
  { file: 'logo.png', size: 512 },
]

const BACKGROUNDS = [
  { file: 'background_stage_01.png', out: 'background_stage_01.webp' },
  { file: 'background_stage_02.png', out: 'background_stage_02.webp' },
  { file: 'background_menu.png', out: 'background_menu.webp' },
]

/** Convert "sprite painted on black" into a transparent sprite. */
async function keySprite(rawPath, outPath, size) {
  const { data, info } = await sharp(rawPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const px = new Uint8ClampedArray(data)
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    // Alpha from brightest channel: black stays transparent, glow fades out.
    const a = Math.max(r, g, b)
    if (a === 0) {
      px[i + 3] = 0
      continue
    }
    // Un-premultiply so the color keeps its hue when composited.
    const f = 255 / a
    px[i] = Math.min(255, r * f)
    px[i + 1] = Math.min(255, g * f)
    px[i + 2] = Math.min(255, b * f)
    px[i + 3] = a
  }

  await sharp(Buffer.from(px.buffer), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 8 })
    .resize(size, size, {
      fit: 'inside',
      withoutEnlargement: false,
      kernel: 'lanczos3',
    })
    .png({ compressionLevel: 9, palette: false })
    .toFile(outPath)
}

async function main() {
  await mkdir(OUT, { recursive: true })

  for (const s of SPRITES) {
    const raw = path.join(RAW, s.file)
    const out = path.join(OUT, s.file)
    await keySprite(raw, out, s.size)
    console.log('sprite ok:', s.file)
  }

  for (const b of BACKGROUNDS) {
    await sharp(path.join(RAW, b.file))
      .resize(1920, 1080, { fit: 'cover' })
      .webp({ quality: 72 })
      .toFile(path.join(OUT, b.out))
    console.log('background ok:', b.out)
  }

  console.log('All assets processed into', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
