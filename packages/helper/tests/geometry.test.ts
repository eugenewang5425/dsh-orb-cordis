import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BALL_WINDOW_SIZE, CHROME_INSET, FloatingPlacement, PANEL_WINDOW_SIZE, type Rect } from '../src/geometry.ts'

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

describe('docking from an expanded release (#62)', () => {
  it('docks when the release leaves the panel hanging past the right edge', async () => {
    const displays = [pair(0, 0, 1440, 900)]
    const { placed, bounds } = expandedPlacement(displays, 700, 400, 1500, 400)
    const state = await placed.clamp()
    assert.equal(state.docked, 'right')
    assert.deepEqual(bounds(), { x: 1406, y: 392, width: 34, height: 88 })
  })

  it('stays expanded when the release is inside the work area', async () => {
    const displays = [pair(0, 0, 1440, 900)]
    const { placed, bounds } = expandedPlacement(displays, 700, 400, 700, 400)
    const state = await placed.clamp()
    assert.equal(state.docked, undefined)
    assert.equal(bounds().width, PANEL_WINDOW_SIZE.width)
    assert.equal(bounds().height, PANEL_WINDOW_SIZE.height)
  })
})

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
  return new FloatingPlacement({
    getBounds: () => ({ ...bounds }),
    setBounds(next) { bounds = { ...next } },
  }, (point) => nearest(displays, point), () => displays.map((display) => display.bounds))
}

/** Expand, drag with the panel open, and hand back a bounds readout for assertions. */
function expandedPlacement(
  displays: { bounds: Rect; workArea: Rect }[],
  x: number,
  y: number,
  moveX: number,
  moveY: number,
): { placed: FloatingPlacement; bounds(): Rect } {
  let bounds: Rect = {
    x: x - CHROME_INSET,
    y: y - CHROME_INSET,
    width: BALL_WINDOW_SIZE,
    height: BALL_WINDOW_SIZE,
  }
  const placed = new FloatingPlacement({
    getBounds: () => ({ ...bounds }),
    setBounds(next) { bounds = { ...next } },
  }, (point) => nearest(displays, point), () => displays.map((display) => display.bounds))
  placed.setExpanded(true)
  placed.move(moveX, moveY)
  return { placed, bounds: () => ({ ...bounds }) }
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
