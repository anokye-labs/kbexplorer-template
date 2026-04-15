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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    minHeight: 'inherit',
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
      fitOnStabilize: true,
      nodeSizeRange: [10, 20],
      nodeSizeStep: 2,
      labelMaxLength: 0,
    })
    network.once('stabilized', () => {
      network.setOptions({ physics: { enabled: false } })
      network.fit({ animation: false })
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
