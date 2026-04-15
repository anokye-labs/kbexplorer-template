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
    marginBottom: '2rem',
  },
  canvas: {
    position: 'absolute',
    inset: 0,
    opacity: 0.3,
    pointerEvents: 'none',
  },
  overlay: {
    position: 'relative',
    zIndex: 1,
    padding: '3rem 2rem 2rem',
  },
  glow: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(100px)',
    opacity: 0.1,
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
      <div className={styles.glow} style={{ background: '#4A9CC8', width: '40vw', height: '40vw', top: '-30%', left: '-10%' }} />
      <div className={styles.glow} style={{ background: '#E8A838', width: '35vw', height: '35vw', bottom: '-25%', right: '-5%' }} />
      <div ref={canvasRef} className={styles.canvas} />
      <div className={styles.overlay}>
        {children}
      </div>
    </div>
  )
}
