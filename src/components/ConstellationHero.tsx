/**
 * ConstellationHero — renders a translucent force-directed graph
 * behind content as a decorative background. Used by the homepage
 * display mode and available for any rich node.
 */
import { useEffect, useRef } from 'react'
import { makeStyles, tokens } from '@fluentui/react-components'
import type { KBGraph } from '../types'
import { createGraphNetwork } from '../engine/createGraphNetwork'

const useStyles = makeStyles({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusXLarge,
    marginBottom: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
  },
  canvas: {
    position: 'absolute',
    inset: 0,
    opacity: 0.35,
    pointerEvents: 'none',
  },
  overlay: {
    position: 'relative',
    zIndex: 2,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  fade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    background: 'linear-gradient(to bottom, transparent, var(--colorNeutralBackground1, #1a1a2e))',
    zIndex: 1,
    pointerEvents: 'none',
  },
  glow: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(100px)',
    opacity: 0.12,
    pointerEvents: 'none',
    zIndex: 0,
  },
})

interface ConstellationHeroProps {
  graph: KBGraph
  height?: string
  children?: React.ReactNode
}

export function ConstellationHero({ graph, height = '35vh', children }: ConstellationHeroProps) {
  const styles = useStyles()
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const { network } = createGraphNetwork({
      container: canvasRef.current,
      graph,
      isDark: true,
      interactive: false,
      fitOnStabilize: false,
      nodeSizeRange: [8, 18],
      nodeSizeStep: 2,
      labelMaxLength: 0,
    })
    // Override physics to spread nodes across the hero
    network.setOptions({
      physics: {
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -200,
          centralGravity: 0.005,
          springLength: 300,
          springConstant: 0.02,
          damping: 0.5,
        },
        stabilization: { enabled: true, iterations: 300 },
      },
    })
    network.once('stabilized', () => {
      network.setOptions({ physics: { enabled: false } })
      network.fit({ animation: false, minZoomLevel: 0.3, maxZoomLevel: 0.8 })
    })
    return () => { try { network.destroy() } catch { /* */ } }
  }, [graph])

  return (
    <div className={styles.wrapper} style={{ minHeight: height }}>
      <div className={styles.glow} style={{ background: '#4A9CC8', width: '40vw', height: '40vw', top: '-20%', left: '10%' }} />
      <div className={styles.glow} style={{ background: '#E8A838', width: '35vw', height: '35vw', bottom: '-15%', right: '15%' }} />
      <div ref={canvasRef} className={styles.canvas} />
      <div className={styles.fade} />
      <div className={styles.overlay}>
        {children}
      </div>
    </div>
  )
}
