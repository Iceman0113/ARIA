import { useEffect, useRef } from 'react';
import { createScene } from './scene.js';

export default function NeuralMap({ data, workStates }) {
  const canvasRef = useRef(null);
  const labelLayerRef = useRef(null);
  const tooltipRef = useRef(null);
  const sceneHandleRef = useRef(null);

  // Build (and rebuild) the scene whenever the data set changes — e.g. when the
  // initial MOCK_DATA is replaced by the server-fetched /neural-map payload.
  // dispose() tears the old scene down fully (incl. CSS2D labels) so the rebuild
  // doesn't stack duplicates.
  useEffect(() => {
    if (!canvasRef.current) return;
    const handle = createScene({
      canvas: canvasRef.current,
      labelLayer: labelLayerRef.current,
      tooltip: tooltipRef.current,
      data,
      workStates,
    });
    sceneHandleRef.current = handle;

    // Granular live updates pushed from App.jsx's WS handler as window events,
    // so the scene mutates in place without a full rebuild.
    const onFreshness = (e) => handle.setFreshness?.(e.detail.id, e.detail.freshness);
    const onAdd       = (e) => handle.addLeaf?.(e.detail);
    const onRemove    = (e) => handle.removeLeaf?.(e.detail.id);
    window.addEventListener('aria:freshness',    onFreshness);
    window.addEventListener('aria:node_added',   onAdd);
    window.addEventListener('aria:node_removed', onRemove);

    return () => {
      window.removeEventListener('aria:freshness',    onFreshness);
      window.removeEventListener('aria:node_added',   onAdd);
      window.removeEventListener('aria:node_removed', onRemove);
      handle.dispose();
      sceneHandleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Push live work-state changes into the scene without re-mounting
  useEffect(() => {
    sceneHandleRef.current?.setWorkStates?.(workStates);
  }, [workStates]);

  return (
    <>
      <canvas id="neural-canvas" ref={canvasRef} />
      <div id="label-layer" ref={labelLayerRef} />
      <div id="neural-tooltip" ref={tooltipRef}>
        <div className="label" />
        <div className="detail" />
        <div className="freshness" />
        <div className="bar"><div className="fill" /></div>
      </div>
    </>
  );
}
