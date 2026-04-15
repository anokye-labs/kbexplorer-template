#!/usr/bin/env node
/**
 * generate-icon-manifest.js — Scans the fluentui-system-icons submodule
 * and produces a JSON manifest of all icon families with metadata and SVG paths.
 *
 * Output: src/generated/icon-manifest.json
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const assetsDir = resolve(root, 'fluentui-system-icons', 'assets')
const outPath = resolve(root, 'src', 'generated', 'icon-manifest.json')

if (!existsSync(assetsDir)) {
  console.error('[icons] fluentui-system-icons/assets not found')
  process.exit(1)
}

console.log('[icons] Scanning icon families...')

const families = []

for (const dir of readdirSync(assetsDir)) {
  const familyDir = join(assetsDir, dir)
  if (!statSync(familyDir).isDirectory()) continue

  const metaPath = join(familyDir, 'metadata.json')
  if (!existsSync(metaPath)) continue

  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'))

    // Find available SVGs
    const svgDir = join(familyDir, 'SVG')
    const svgs = []
    if (existsSync(svgDir)) {
      for (const f of readdirSync(svgDir)) {
        if (f.endsWith('.svg')) {
          const match = f.match(/ic_fluent_.*?_(\d+)_(regular|filled)\.svg/)
          if (match) {
            svgs.push({
              size: parseInt(match[1]),
              style: match[2],
              file: f,
            })
          }
        }
      }
    }

    // Read the 24px regular SVG as the representative
    const repr = svgs.find(s => s.size === 24 && s.style === 'regular')
      || svgs.find(s => s.style === 'regular')
      || svgs[0]

    let svgContent = null
    if (repr) {
      svgContent = readFileSync(join(svgDir, repr.file), 'utf8')
    }

    families.push({
      id: dir.toLowerCase().replace(/\s+/g, '-'),
      name: meta.name || dir,
      description: meta.description || '',
      metaphors: meta.metaphor || [],
      sizes: (meta.size || []).sort((a, b) => a - b),
      styles: meta.style || [],
      variantCount: svgs.length,
      svg: svgContent,
    })
  } catch {
    // skip malformed entries
  }
}

// Sort alphabetically
families.sort((a, b) => a.name.localeCompare(b.name))

// Group into categories by first letter
const manifest = {
  totalFamilies: families.length,
  totalVariants: families.reduce((sum, f) => sum + f.variantCount, 0),
  families,
}

writeFileSync(outPath, JSON.stringify(manifest, null, 2))
console.log(`[icons] Written ${families.length} families to ${outPath}`)
