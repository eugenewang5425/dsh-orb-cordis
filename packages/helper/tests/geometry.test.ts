import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  AGENT_STRIP_WIDTH,
  BALL_WINDOW_SIZE,
  CHROME_INSET,
  FloatingPlacement,
  PANEL_WINDOW_SIZE,
  ballOriginFromWindow,
  type Rect,
} from '../src/geometry.ts'

describe('docking on more than one display', () => {
  it('does not dock on the seam between two displays', async () => {
    const displays = [
      pair(0, 0, 1440, 900),
      pair(1440, 0, 1920, 1080),
    ]
    const placed = placement(displays, 1388, 400)
    placed.move(1388, 400)
    const seam = await placed.clamp()
    assert.equal(seam.docked, undefined)

    const outer = placement(displays, 3302, 400)
    outer.move(3302, 400)
    const docked = await outer.clamp()
    assert.equal(docked.docked, 'right')
  })
})

describe('bookmark strip geometry', () => {
  it('widens the expanded window on the far edge and keeps the ball origin', () => {
    const displays = [pair(0, 0, 1920, 1080)]
    // Right half of the screen: the panel expands left, so the strip rides the left edge.
    const ball = { x: 1600, y: 400 }
    const placed = placement(displays, ball.x, ball.y)
    placed.setStrip(AGENT_STRIP_WIDTH)
    const state = placed.setExpanded(true)
    assert.equal(state.strip, AGENT_STRIP_WIDTH)
    assert.equal(state.horizontal, 'left')
    const bounds = lastBounds.get(placed)
    assert.ok(bounds)
    assert.equal(bounds.width, PANEL_WINDOW_SIZE.width + AGENT_STRIP_WIDTH)
    const origin = ballOriginFromWindow(bounds, state)
    assert.equal(origin.x, ball.x)
    assert.equal(origin.y, ball.y)
  })

  it('re-bounds live when the strip appears while expanded and shrinks back when it clears', () => {
    const displays = [pair(0, 0, 1920, 1080)]
    const ball = { x: 1600, y: 400 }
    const placed = placement(displays, ball.x, ball.y)
    const expanded = placed.setExpanded(true)
    assert.equal(expanded.strip, 0)
    const before = lastBounds.get(placed)
    assert.ok(before)
    assert.equal(before.width, PANEL_WINDOW_SIZE.width)

    const appeared = placed.setStrip(AGENT_STRIP_WIDTH)
    assert.equal(appeared.strip, AGENT_STRIP_WIDTH)
    assert.equal(appeared.expanded, true)
    const widened = lastBounds.get(placed)
    assert.ok(widened)
    assert.equal(widened.width, PANEL_WINDOW_SIZE.width + AGENT_STRIP_WIDTH)
    const origin = ballOriginFromWindow(widened, appeared)
    assert.deepEqual(origin, ballOriginFromWindow(before, expanded))

    const cleared = placed.setStrip(0)
    assert.equal(cleared.strip, 0)
    assert.equal(lastBounds.get(placed)?.width, PANEL_WINDOW_SIZE.width)
  })

  it('keeps the collapsed window ball-sized regardless of the strip reserve', () => {
    const displays = [pair(0, 0, 1920, 1080)]
    const placed = placement(displays, 1600, 400)
    placed.setStrip(AGENT_STRIP_WIDTH)
    const state = placed.setExpanded(false)
    assert.equal(state.strip, AGENT_STRIP_WIDTH)
    const bounds = lastBounds.get(placed)
    assert.ok(bounds)
    assert.equal(bounds.width, BALL_WINDOW_SIZE)
    assert.equal(bounds.height, BALL_WINDOW_SIZE)
  })

  it('keeps dragging expanded with the strip reserved', () => {
    const displays = [pair(0, 0, 1920, 1080)]
    const placed = placement(displays, 1600, 400)
    placed.setStrip(AGENT_STRIP_WIDTH)
    placed.setExpanded(true)
    placed.move(1500, 500)
    const bounds = lastBounds.get(placed)
    assert.ok(bounds)
    assert.equal(bounds.width, PANEL_WINDOW_SIZE.width + AGENT_STRIP_WIDTH)
    // The drag moves the ball origin; the recovered origin must match the requested one.
    const origin = ballOriginFromWindow(bounds, { horizontal: 'left', vertical: 'up' })
    assert.equal(origin.x, 1500)
    assert.equal(origin.y, 500)
  })
})

const lastBounds = new WeakMap<FloatingPlacement, Rect>()

function pair(x: number, y: number, width: number, height: number): { bounds: Rect; workArea: Rect } {
  const bounds = { x, y, width, height }
  return { bounds, workArea: bounds }
}

function placement(displays: { bounds: Rect; workArea: Rect }[], x: number, y: number): FloatingPlacement {
  let bounds: Rect = {
    x: x - CHROME_INSET,
    y: y - CHROME_INSET,
    width: BALL_WINDOW_SIZE,
    height: BALL_WINDOW_SIZE,
  }
  const placed = new FloatingPlacement({
    getBounds: () => ({ ...bounds }),
    setBounds(next) { bounds = { ...next }; lastBounds.set(placed, { ...next }) },
  }, (point) => nearest(displays, point), () => displays.map((display) => display.bounds))
  return placed
}

function nearest(displays: { bounds: Rect; workArea: Rect }[], point: { x: number; y: number }) {
  let best = displays[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const display of displays) {
    const cx = display.bounds.x + display.bounds.width / 2
    const cy = display.bounds.y + display.bounds.height / 2
    const distance = (cx - point.x) ** 2 + (cy - point.y) ** 2
    if (distance < bestDistance) {
      best = display
      bestDistance = distance
    }
  }
  if (best === undefined) throw new Error('no display')
  return best
}
