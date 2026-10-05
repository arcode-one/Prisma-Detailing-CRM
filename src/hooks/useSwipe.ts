import { useRef } from 'react'

/**
 * Листание влево/вправо: палец на телефоне, перетаскивание мышью и
 * горизонтальная прокрутка тачпадом на ПК. onSwipe(1) — вперёд (свайп влево), -1 — назад.
 * Возвращает обработчики для контейнера.
 */
export function useSwipe(onSwipe: (dir: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const dragged = useRef(false)
  const wheel = useRef({ acc: 0, lockUntil: 0 })

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      start.current = { x: e.clientX, y: e.clientY }
      dragged.current = false
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        dragged.current = true // после перетаскивания мышью не «кликаем» по дню под курсором
        onSwipe(dx < 0 ? 1 : -1)
      }
    },
    onPointerCancel: () => {
      start.current = null
    },
    onPointerLeave: () => {
      start.current = null
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (dragged.current) {
        dragged.current = false
        e.preventDefault()
        e.stopPropagation()
      }
    },
    onWheel: (e: React.WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      const w = wheel.current
      const now = Date.now()
      if (now < w.lockUntil) return
      w.acc += e.deltaX
      if (Math.abs(w.acc) > 60) {
        onSwipe(w.acc > 0 ? 1 : -1)
        w.acc = 0
        w.lockUntil = now + 450 // один жест тачпада — одно листание
      }
    },
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
  }
}
