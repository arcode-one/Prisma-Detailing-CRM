// Генерирует иконки PWA, apple-touch-icon, favicon и splash-экраны iOS
// из векторного знака. Запуск: npm run assets
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const BG = '#0b0f0c'

// Тот же силуэт машинки, что в логотипе (src/components/Logo.tsx → CarMark), viewBox 48×18
const CAR = `
  <path d="M1.5 13.2V11c0-1.6 1-2.6 2.7-3l7.3-1.4 5.6-3.9c1-.7 2.2-1.1 3.5-1.1h7.6c1.5 0 2.9.6 3.9 1.7l3.5 3.6 6.3 1.3c2 .4 3.1 1.6 3.1 3.3v2H1.5z" fill="url(#g)"/>
  <path d="M18.4 6.4l3.4-2.5c.5-.3 1-.5 1.6-.5h3.2v3h-8.2zM28.3 3.4h1.4c1 0 1.9.4 2.6 1.1l1.9 1.9h-5.9v-3z" fill="#0b0f0c" opacity="0.75"/>
  <circle cx="12" cy="13.6" r="3.6" fill="#0b0f0c" stroke="#5CFF8F" stroke-width="1.6"/>
  <circle cx="37" cy="13.6" r="3.6" fill="#0b0f0c" stroke="#5CFF8F" stroke-width="1.6"/>
  <path d="M0 5.5h7M2 8h4" stroke="#5CFF8F" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>`

const GRAD = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22C55E"/><stop offset="1" stop-color="#5CFF8F"/></linearGradient>`

/** Машинка по центру на тёмном фоне. scale — доля ширины, которую занимает машинка. Без свечения. */
function carSvg(w, h, scale, rx = 0) {
  const cw = Math.min(w, h) * scale
  const k = cw / 48
  const ch = 18 * k
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${GRAD}</defs>
  <rect width="${w}" height="${h}" rx="${rx}" fill="${BG}"/>
  <g transform="translate(${(w - cw) / 2} ${(h - ch) / 2}) scale(${k})">${CAR}</g>
</svg>`
}

const iconSvg = ({ size, scale, rounded }) => carSvg(size, size, scale, rounded ? size * 0.22 : 0)
const splashSvg = (w, h) => carSvg(w, h, 0.42)

// Портретные экраны iPhone/iPad: CSS-ширина, высота, плотность
const SPLASH = [
  [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3],
  [414, 896, 3], [414, 896, 2], [375, 667, 2], [320, 568, 2], [402, 874, 3], [440, 956, 3],
  [768, 1024, 2], [820, 1180, 2], [834, 1194, 2], [1024, 1366, 2],
]

const png = (svg, file) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file)

await mkdir('public/icons', { recursive: true })
await mkdir('public/splash', { recursive: true })

await png(iconSvg({ size: 192, scale: 0.78, rounded: false }), 'public/icons/icon-192.png')
await png(iconSvg({ size: 512, scale: 0.78, rounded: false }), 'public/icons/icon-512.png')
await png(iconSvg({ size: 512, scale: 0.62, rounded: false }), 'public/icons/maskable-512.png')
await png(iconSvg({ size: 180, scale: 0.76, rounded: false }), 'public/icons/apple-touch-icon.png')
await writeFile('public/favicon.svg', iconSvg({ size: 64, scale: 0.9, rounded: true }))

const links = []
for (const [cw, ch, dpr] of SPLASH) {
  const w = cw * dpr
  const h = ch * dpr
  const name = `splash/${w}x${h}.png`
  await png(splashSvg(w, h), `public/${name}`)
  links.push(
    `    <link rel="apple-touch-startup-image" href="/${name}" media="(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" />`,
  )
}

// Вписываем ссылки на splash в index.html между маркерами
const html = await readFile('index.html', 'utf8')
const block = `<!--splash-->\n${links.join('\n')}\n    <!--/splash-->`
const next = html.includes('<!--/splash-->')
  ? html.replace(/<!--splash-->[\s\S]*?<!--\/splash-->/, block)
  : html.replace('<!--splash-->', block)
await writeFile('index.html', next)

console.log(`✓ иконки и ${SPLASH.length} splash-экранов готовы`)
