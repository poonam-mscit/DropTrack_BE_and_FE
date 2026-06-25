'use client';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Animated mesh-gradient blobs. Fixed position behind all content.
 * Drifts slowly via Framer Motion — disabled under reduced-motion.
 */
export function MeshBackground() {
  const reduce = useReducedMotion();
  return (
    <>
      <div className="mesh-bg" aria-hidden="true" />
      <div className="noise-overlay" aria-hidden="true" />
      {!reduce && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <motion.div
            className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
            animate={{ x: [0, 60, -20, 0], y: [0, 40, -30, 0] }}
            transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-1/3 -right-40 w-[700px] h-[700px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(168,85,247,0.30) 0%, transparent 70%)',
              filter: 'blur(70px)',
            }}
            animate={{ x: [0, -50, 30, 0], y: [0, 60, -20, 0] }}
            transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-40 left-1/4 w-[700px] h-[700px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(163,230,53,0.18) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
            animate={{ x: [0, 40, -40, 0], y: [0, -50, 30, 0] }}
            transition={{ duration: 36, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      )}
    </>
  );
}
