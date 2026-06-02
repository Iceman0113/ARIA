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
    sceneHandleRef.current = createScene({
      canvas: canvasRef.current,
      labelLayer: labelLayerRef.current,
      tooltip: tooltipRef.current,
      data,
      workStates,
    });
    return () => {
      sceneHandleRef.current?.dispose();
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
