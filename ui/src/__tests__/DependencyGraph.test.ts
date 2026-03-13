import { describe, it, expect } from 'vitest'
import { calcZoomTransform, calcPanTransform, buildSmoothPath } from '../components/DependencyGraph'

describe('calcZoomTransform', () => {
  it('zooms in when deltaY is negative (scroll up)', () => {
    const prev = { x: 0, y: 0, scale: 1 }
    const result = calcZoomTransform(prev, -100, 400, 300)
    expect(result.scale).toBeGreaterThan(1)
    // factor is 1.1 for negative deltaY
    expect(result.scale).toBeCloseTo(1.1, 5)
  })

  it('zooms out when deltaY is positive (scroll down)', () => {
    const prev = { x: 0, y: 0, scale: 1 }
    const result = calcZoomTransform(prev, 100, 400, 300)
    expect(result.scale).toBeLessThan(1)
    expect(result.scale).toBeCloseTo(0.9, 5)
  })

  it('zooms toward mouse position (point under cursor stays fixed)', () => {
    const prev = { x: 50, y: 50, scale: 1 }
    const mouseX = 200
    const mouseY = 150

    const result = calcZoomTransform(prev, -100, mouseX, mouseY)

    // The point under the cursor in graph-space should remain the same.
    // Before zoom: graphX = (mouseX - prev.x) / prev.scale = 150
    // After zoom: graphX = (mouseX - result.x) / result.scale
    const graphXBefore = (mouseX - prev.x) / prev.scale
    const graphXAfter = (mouseX - result.x) / result.scale
    expect(graphXAfter).toBeCloseTo(graphXBefore, 5)

    const graphYBefore = (mouseY - prev.y) / prev.scale
    const graphYAfter = (mouseY - result.y) / result.scale
    expect(graphYAfter).toBeCloseTo(graphYBefore, 5)
  })

  it('clamps scale to minimum 0.1', () => {
    const prev = { x: 0, y: 0, scale: 0.11 }
    const result = calcZoomTransform(prev, 100, 0, 0)
    // 0.11 * 0.9 = 0.099 -> clamped to 0.1
    expect(result.scale).toBeCloseTo(0.1, 5)
  })

  it('clamps scale to maximum 3', () => {
    const prev = { x: 0, y: 0, scale: 2.8 }
    const result = calcZoomTransform(prev, -100, 0, 0)
    // 2.8 * 1.1 = 3.08 -> clamped to 3
    expect(result.scale).toBe(3)
  })

  it('preserves transform origin at 0,0 mouse position with 0,0 translate', () => {
    const prev = { x: 0, y: 0, scale: 1 }
    const result = calcZoomTransform(prev, -100, 0, 0)
    // Zooming at origin should keep x,y at 0
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })
})

describe('calcPanTransform', () => {
  it('computes correct translation from drag delta', () => {
    const result = calcPanTransform(
      1.5,
      { x: 100, y: 100 },
      { x: 50, y: 50 },
      { x: 200, y: 250 },
    )
    expect(result).toEqual({
      scale: 1.5,
      x: 150,  // 50 + (200 - 100)
      y: 200,  // 50 + (250 - 100)
    })
  })

  it('preserves scale during pan', () => {
    const result = calcPanTransform(
      2.0,
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 50, y: 30 },
    )
    expect(result.scale).toBe(2.0)
  })

  it('handles negative drag (dragging left/up)', () => {
    const result = calcPanTransform(
      1,
      { x: 300, y: 300 },
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    )
    expect(result).toEqual({
      scale: 1,
      x: 0,    // 100 + (200 - 300) = 0
      y: 0,    // 100 + (200 - 300) = 0
    })
  })

  it('returns unchanged position when mouse has not moved', () => {
    const result = calcPanTransform(
      1,
      { x: 150, y: 150 },
      { x: 80, y: 60 },
      { x: 150, y: 150 },
    )
    expect(result).toEqual({ scale: 1, x: 80, y: 60 })
  })
})

describe('buildSmoothPath', () => {
  it('returns empty string for less than 2 points', () => {
    expect(buildSmoothPath([])).toBe('')
    expect(buildSmoothPath([{ x: 1, y: 2 }])).toBe('')
  })

  it('returns a straight line for exactly 2 points', () => {
    const result = buildSmoothPath([{ x: 0, y: 0 }, { x: 100, y: 100 }])
    expect(result).toBe('M 0 0 L 100 100')
  })

  it('returns a curve for 3+ points', () => {
    const result = buildSmoothPath([
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ])
    expect(result).toContain('M 0 0')
    expect(result).toContain('Q')
    expect(result).toContain('L 100 0')
  })
})
