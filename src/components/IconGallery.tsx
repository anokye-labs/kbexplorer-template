/**
 * IconGallery — browseable grid of Fluent UI System Icons.
 * Lazy-loads icon-manifest.json and renders a searchable, tiled gallery.
 */
import { useState, useEffect, useMemo } from 'react'
import {
  makeStyles,
  tokens,
  SearchBox,
  Caption1,
  Body1Strong,
  Badge,
  Card,
  Title2,
  Subtitle2,
} from '@fluentui/react-components'

interface IconFamily {
  id: string
  name: string
  description: string
  metaphors: string[]
  sizes: number[]
  styles: string[]
  variantCount: number
  svg: string | null
}

interface IconManifest {
  totalFamilies: number
  totalVariants: number
  families: IconFamily[]
}

const useStyles = makeStyles({
  root: {
    marginTop: '1.5rem',
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
  },
  stats: {
    opacity: 0.5,
    fontSize: '0.85rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '0.5rem',
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem 0.5rem',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid transparent`,
    cursor: 'pointer',
    transition: 'all 0.15s',
    ':hover': {
      border: `1px solid ${tokens.colorNeutralStroke1}`,
      backgroundColor: tokens.colorNeutralBackground3,
      transform: 'scale(1.05)',
    },
  },
  tileSvg: {
    width: 32,
    height: 32,
    marginBottom: '0.5rem',
    opacity: 0.85,
  },
  tileName: {
    fontSize: '0.65rem',
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 1.2,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // Detail overlay
  detailOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  detailCard: {
    maxWidth: '600px',
    width: '90vw',
    maxHeight: '85vh',
    overflowY: 'auto',
    padding: '2rem',
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    marginBottom: '1.5rem',
  },
  detailSvgLarge: {
    width: 80,
    height: 80,
    flexShrink: 0,
  },
  detailMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  detailSizes: {
    display: 'flex',
    gap: '1.5rem',
    flexWrap: 'wrap',
    marginTop: '1rem',
  },
  sizePreview: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },

  loadingMsg: {
    padding: '3rem',
    textAlign: 'center',
    opacity: 0.5,
  },
})

// Pagination
const PAGE_SIZE = 200

export function IconGallery() {
  const styles = useStyles()
  const [manifest, setManifest] = useState<IconManifest | null>(null)
  const [search, setSearch] = useState('')
  const [selectedIcon, setSelectedIcon] = useState<IconFamily | null>(null)
  const [page, setPage] = useState(0)

  // Lazy-load the icon manifest
  useEffect(() => {
    import('../generated/icon-manifest.json')
      .then(mod => setManifest((mod.default ?? mod) as IconManifest))
      .catch(() => setManifest(null))
  }, [])

  // Filter by search
  const filtered = useMemo(() => {
    if (!manifest) return []
    if (!search.trim()) return manifest.families
    const q = search.toLowerCase()
    return manifest.families.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      f.metaphors.some(m => m.toLowerCase().includes(q))
    )
  }, [manifest, search])

  // Paginated slice
  const visible = filtered.slice(0, (page + 1) * PAGE_SIZE)
  const hasMore = visible.length < filtered.length

  if (!manifest) {
    return <div className={styles.loadingMsg}>Loading icon library…</div>
  }

  return (
    <div className={styles.root}>
      {/* Search + stats */}
      <div className={styles.searchRow}>
        <SearchBox
          placeholder="Search icons by name or metaphor…"
          value={search}
          onChange={(_e, data) => { setSearch(data.value); setPage(0) }}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Caption1 className={styles.stats}>
          {filtered.length === manifest.totalFamilies
            ? `${manifest.totalFamilies} families · ${manifest.totalVariants} variants`
            : `${filtered.length} matches`}
        </Caption1>
      </div>

      {/* Grid */}
      <div className={styles.grid}>
        {visible.map(icon => (
          <div
            key={icon.id}
            className={styles.tile}
            onClick={() => setSelectedIcon(icon)}
            title={icon.description || icon.name}
          >
            {icon.svg ? (
              <div
                className={styles.tileSvg}
                dangerouslySetInnerHTML={{
                  __html: icon.svg
                    .replace(/fill="#\w+"/g, `fill="currentColor"`)
                    .replace(/width="\d+"/, 'width="32"')
                    .replace(/height="\d+"/, 'height="32"'),
                }}
              />
            ) : (
              <div className={styles.tileSvg} style={{ opacity: 0.2 }}>?</div>
            )}
            <span className={styles.tileName}>{icon.name}</span>
          </div>
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Caption1
            style={{ cursor: 'pointer', opacity: 0.6 }}
            onClick={() => setPage(p => p + 1)}
          >
            Show more ({filtered.length - visible.length} remaining)
          </Caption1>
        </div>
      )}

      {/* Detail overlay */}
      {selectedIcon && (
        <div className={styles.detailOverlay} onClick={() => setSelectedIcon(null)}>
          <Card className={styles.detailCard} onClick={e => e.stopPropagation()}>
            <div className={styles.detailHeader}>
              {selectedIcon.svg && (
                <div
                  className={styles.detailSvgLarge}
                  dangerouslySetInnerHTML={{
                    __html: selectedIcon.svg
                      .replace(/fill="#\w+"/g, `fill="currentColor"`)
                      .replace(/width="\d+"/, 'width="80"')
                      .replace(/height="\d+"/, 'height="80"'),
                  }}
                />
              )}
              <div>
                <Title2>{selectedIcon.name}</Title2>
                {selectedIcon.description && (
                  <Caption1 style={{ display: 'block', opacity: 0.6, marginTop: 4 }}>
                    {selectedIcon.description}
                  </Caption1>
                )}
              </div>
            </div>

            {/* Metaphors */}
            {selectedIcon.metaphors.length > 0 && (
              <div className={styles.detailMeta}>
                {selectedIcon.metaphors.map(m => (
                  <Badge key={m} appearance="outline" size="medium">{m}</Badge>
                ))}
              </div>
            )}

            {/* Sizes + styles */}
            <Subtitle2 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
              {selectedIcon.variantCount} variants · {selectedIcon.styles.join(' & ')}
            </Subtitle2>

            <div className={styles.detailSizes}>
              {selectedIcon.sizes.map(size => (
                <div key={size} className={styles.sizePreview}>
                  {selectedIcon.svg && (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: selectedIcon.svg
                          .replace(/fill="#\w+"/g, `fill="currentColor"`)
                          .replace(/width="\d+"/, `width="${size}"`)
                          .replace(/height="\d+"/, `height="${size}"`),
                      }}
                    />
                  )}
                  <Caption1 style={{ opacity: 0.5 }}>{size}px</Caption1>
                </div>
              ))}
            </div>

            {/* Close hint */}
            <Caption1 style={{ display: 'block', textAlign: 'center', opacity: 0.3, marginTop: '1.5rem' }}>
              Click outside to close
            </Caption1>
          </Card>
        </div>
      )}
    </div>
  )
}
