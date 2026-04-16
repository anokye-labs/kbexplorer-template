import { test, expect } from '@playwright/test'

test.describe('Visual Validation', () => {

  // ── Homepage ──────────────────────────────────────────

  test('homepage renders hero + prose + widgets', async ({ page }) => {
    await page.goto('/#/node/home', { timeout: 60000 })
    await page.waitForTimeout(3000)

    // Hero title
    const h1 = page.locator('h1')
    await expect(h1).toBeVisible()
    await expect(h1).toContainText('kbexplorer')

    // Prose section
    await expect(page.locator('.kb-prose')).toBeVisible()

    // Stats ribbon (look for node count numbers)
    const body = await page.textContent('body')
    expect(body).toMatch(/\d+Nodes/)

    // CTAs — rendered as Fluent Buttons in HomePage
    const exploreBtn = page.getByRole('button', { name: 'Explore the Graph' })
    const browseBtn = page.getByRole('button', { name: 'Browse All Nodes' })
    const hasCtas = (await exploreBtn.count()) > 0 || (await browseBtn.count()) > 0
    // Also check for anchor-based CTAs
    const exploreLink = page.locator('a:has-text("Explore the Graph")')
    const hasLinks = (await exploreLink.count()) > 0
    expect(hasCtas || hasLinks).toBe(true)
  })

  // ── HUD Controls ──────────────────────────────────────

  test('HUD has all controls', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 })
    await page.waitForTimeout(3000)

    // MAP and Cards buttons
    await expect(page.getByRole('button', { name: 'MAP' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cards' })).toBeVisible()

    // Dock buttons
    await expect(page.getByRole('button', { name: 'Dock bottom' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dock left' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dock right' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dock top' })).toBeVisible()

    // Theme buttons
    await expect(page.getByRole('button', { name: /Dark/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Light/ })).toBeVisible()

    // Sliders (at least detail + zoom or font + width)
    const sliders = page.locator('input[type="range"]')
    expect(await sliders.count()).toBeGreaterThanOrEqual(2)
  })

  // ── Dock Switching (live) ─────────────────────────────

  test('dock left works without refresh', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 })
    await page.waitForTimeout(3000)

    await page.getByRole('button', { name: 'Dock left' }).click()
    await page.waitForTimeout(2000)

    const stored = await page.evaluate(() => localStorage.getItem('kbe-hud-dock'))
    expect(stored).toBe('left')

    // Sidebar graph should be visible (canvas element)
    const canvases = await page.locator('canvas').count()
    expect(canvases).toBeGreaterThanOrEqual(1)
  })

  test('dock right works without refresh', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 })
    await page.waitForTimeout(3000)

    await page.getByRole('button', { name: 'Dock right' }).click()
    await page.waitForTimeout(2000)

    const stored = await page.evaluate(() => localStorage.getItem('kbe-hud-dock'))
    expect(stored).toBe('right')

    // Verify sidebar is on the right side
    const layout = await page.evaluate(() => {
      const sidebar = document.querySelector('[class*=expandedContent]') as HTMLElement
      if (!sidebar) return null
      const rect = sidebar.getBoundingClientRect()
      return { left: Math.round(rect.left), right: Math.round(rect.right), vpWidth: window.innerWidth }
    })
    if (layout) {
      expect(layout.right).toBeGreaterThan(layout.vpWidth - 50)
    }
  })

  test('dock bottom works without refresh', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 })
    await page.waitForTimeout(3000)

    // Start from left
    await page.getByRole('button', { name: 'Dock left' }).click()
    await page.waitForTimeout(1000)

    // Switch to bottom
    await page.getByRole('button', { name: 'Dock bottom' }).click()
    await page.waitForTimeout(2000)

    const stored = await page.evaluate(() => localStorage.getItem('kbe-hud-dock'))
    expect(stored).toBe('bottom')
  })

  test('dock persists across reload', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 })
    await page.waitForTimeout(3000)

    await page.getByRole('button', { name: 'Dock left' }).click()
    await page.waitForTimeout(1000)

    await page.reload()
    await page.waitForTimeout(3000)

    const stored = await page.evaluate(() => localStorage.getItem('kbe-hud-dock'))
    expect(stored).toBe('left')
  })

  test('dock cycles through all 4 positions without refresh', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 })
    await page.waitForTimeout(3000)

    const positions = ['left', 'right', 'bottom', 'top'] as const
    for (const pos of positions) {
      await page.getByRole('button', { name: `Dock ${pos}` }).click()
      await page.waitForTimeout(1500)

      const stored = await page.evaluate(() => localStorage.getItem('kbe-hud-dock'))
      expect(stored).toBe(pos)
    }

    const hudVisible = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')]
      return buttons.some(b => b.title?.includes('Dock'))
    })
    expect(hudVisible).toBe(true)
  })

  test('MAP overlay opens and closes', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 })
    await page.waitForTimeout(3000)

    await page.getByRole('button', { name: 'MAP' }).click()
    await page.waitForTimeout(2000)

    const canvases = await page.locator('canvas').count()
    expect(canvases).toBeGreaterThanOrEqual(1)

    const dismissBtn = page.getByRole('button', { name: /Dismiss|Close/ })
    if (await dismissBtn.count() > 0) {
      await dismissBtn.click()
    } else {
      await page.keyboard.press('Escape')
    }
    await page.waitForTimeout(1000)
  })

  test('collapse and expand HUD', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 })
    await page.waitForTimeout(3000)

    const collapseBtn = page.getByRole('button', { name: 'Collapse' })
    if (await collapseBtn.count() > 0) {
      await collapseBtn.click()
      await page.waitForTimeout(1000)

      const expandBtn = page.getByRole('button', { name: 'Expand' })
      await expect(expandBtn).toBeVisible({ timeout: 3000 })

      await expandBtn.click()
      await page.waitForTimeout(1000)

      await expect(page.getByRole('button', { name: 'MAP' })).toBeVisible()
    }
  })

  // ── Content Node Rendering ────────────────────────────

  test('content node renders with prose + connections', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 })
    await expect(page.locator('.kb-prose')).toBeVisible({ timeout: 15000 })

    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 })
    const h1 = await page.locator('h1').textContent()
    expect(h1).toBeTruthy()

    // Inline links should be present
    const links = await page.locator('.kb-prose a').count()
    expect(links).toBeGreaterThan(0)
  })

  test('Wikipedia node renders with external link', async ({ page }) => {
    await page.goto('/#/node/wiki-knowledge-graph', { timeout: 60000 })
    await page.waitForTimeout(5000)

    const wikiLink = page.locator('a[href*="wikipedia.org"]')
    await expect(wikiLink).toBeVisible({ timeout: 10000 })
  })

  // ── Icon Gallery ──────────────────────────────────────

  test('icon gallery renders with search', async ({ page }) => {
    await page.goto('/#/node/icon-gallery', { timeout: 60000 })
    await page.waitForTimeout(5000)

    const search = page.getByPlaceholder(/Search icons/)
    await expect(search).toBeVisible({ timeout: 10000 })

    // Fill search
    await search.fill('sparkle')
    await page.waitForTimeout(1000)

    const body = await page.textContent('body')
    expect(body).toMatch(/\d+ matches/)
  })

  // ── Overview Cards ────────────────────────────────────

  test('overview page renders cards grouped by cluster', async ({ page }) => {
    await page.goto('/#/overview', { timeout: 60000 })
    await page.waitForTimeout(3000)

    const h1 = page.locator('h1')
    await expect(h1).toBeVisible()

    // Should have cluster sections
    const body = await page.textContent('body')
    expect(body).toContain('nodes')
    expect(body).toContain('edges')
  })

  // ── Detail Slider ─────────────────────────────────────

  test('detail slider changes visible node count', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 })
    await page.waitForTimeout(3000)
    await page.evaluate(() => localStorage.setItem('kbe-hud-dock', 'left'))
    await page.reload()
    await page.waitForTimeout(5000)

    // Read default trim count
    const body1 = await page.textContent('body')
    const match1 = body1?.match(/(\d+)\/(\d+) nodes/)
    expect(match1).toBeTruthy()
    const defaultShown = parseInt(match1![1])
    const total = parseInt(match1![2])
    expect(defaultShown).toBeLessThanOrEqual(40)
    expect(total).toBeGreaterThan(defaultShown)

    // Change detail to minimum (index 0 = 5 nodes)
    await page.evaluate(() => localStorage.setItem('kbe-detail', '0'))
    await page.reload()
    await page.waitForTimeout(5000)

    const body2 = await page.textContent('body')
    const match2 = body2?.match(/(\d+)\/(\d+) nodes/)
    expect(match2).toBeTruthy()
    const minShown = parseInt(match2![1])
    expect(minShown).toBeLessThanOrEqual(5)
    expect(minShown).toBeLessThan(defaultShown)

    // Reset
    await page.evaluate(() => localStorage.setItem('kbe-detail', '2'))
  })

  // ── Column Width ──────────────────────────────────────

  test('column width slider changes prose width', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 })
    await page.waitForTimeout(3000)

    // Set narrow
    await page.evaluate(() => localStorage.setItem('kbe-col-width', '0'))
    await page.reload()
    await page.waitForTimeout(3000)

    const narrowWidth = await page.evaluate(() => {
      const prose = document.querySelector('.kb-prose')
      return prose ? Math.round(prose.getBoundingClientRect().width) : 0
    })

    // Set wide
    await page.evaluate(() => localStorage.setItem('kbe-col-width', '4'))
    await page.reload()
    await page.waitForTimeout(3000)

    const wideWidth = await page.evaluate(() => {
      const prose = document.querySelector('.kb-prose')
      return prose ? Math.round(prose.getBoundingClientRect().width) : 0
    })

    expect(narrowWidth).toBeGreaterThan(0)
    expect(wideWidth).toBeGreaterThan(narrowWidth)

    // Reset
    await page.evaluate(() => localStorage.setItem('kbe-col-width', '2'))
  })

  // ── Theme Switching ───────────────────────────────────

  test('theme switching changes appearance', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 })
    await page.waitForTimeout(3000)

    // Switch to light
    await page.getByRole('button', { name: /Light/ }).click()
    await page.waitForTimeout(1000)
    const lightBg = await page.evaluate(() => {
      const el = document.querySelector('[class*=fui-FluentProvider]') || document.documentElement
      return getComputedStyle(el).backgroundColor
    })

    // Switch to dark
    await page.getByRole('button', { name: /Dark/ }).click()
    await page.waitForTimeout(1000)
    const darkBg = await page.evaluate(() => {
      const el = document.querySelector('[class*=fui-FluentProvider]') || document.documentElement
      return getComputedStyle(el).backgroundColor
    })

    expect(lightBg).not.toBe(darkBg)
  })

  // ── Navigation Flow ───────────────────────────────────

  test('Home button navigates to homepage', async ({ page }) => {
    await page.goto('/#/node/graph-engine', { timeout: 60000 })
    await page.waitForTimeout(3000)

    await page.getByRole('link', { name: 'Home' }).click()
    await page.waitForTimeout(2000)

    expect(page.url()).toContain('#/node/home')
  })

  test('inline links navigate between nodes', async ({ page }) => {
    await page.goto('/#/node/home', { timeout: 60000 })
    await page.waitForTimeout(3000)

    // Click a link in the prose
    const proseLink = page.locator('.kb-prose a[href*="#/node/"]').first()
    if (await proseLink.count() > 0) {
      const href = await proseLink.getAttribute('href')
      await proseLink.click()
      await page.waitForTimeout(2000)
      expect(page.url()).toContain('#/node/')
      expect(page.url()).not.toContain('#/node/home')
    }
  })

  // ── Performance ───────────────────────────────────────

  test('page load under 10 seconds', async ({ page }) => {
    const start = Date.now()
    await page.goto('/#/node/readme', { timeout: 60000 })
    await page.waitForTimeout(3000)
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(10000)
  })

  test('no console errors on key pages', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error' &&
        !msg.text().includes('403') &&
        !msg.text().includes('rate') &&
        !msg.text().includes('ERR_NAME_NOT_RESOLVED') &&
        !msg.text().includes('net::ERR_')) {
        errors.push(msg.text())
      }
    })

    for (const path of ['/#/node/home', '/#/node/readme', '/#/overview', '/#/node/icon-gallery']) {
      await page.goto(path, { timeout: 60000 })
      await page.waitForTimeout(3000)
    }

    expect(errors).toHaveLength(0)
  })
})
