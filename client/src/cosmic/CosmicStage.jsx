import { useEffect, useRef } from 'react';
import { createScene } from './scene.js';

export default function CosmicStage({ status = 'idle', speaking = false, ampGetter = null }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = createScene(canvas);
    sceneRef.current = scene;
    // The canvas often has near-zero height at mount (layout not settled yet),
    // so the renderer initializes at a degenerate buffer size. Observe the
    // canvas and resize the scene whenever its box changes — this heals the
    // initial sizing and any later container resize (panel collapse, etc.),
    // not just window resizes. (ResizeObserver is absent in jsdom — guard it.)
    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && canvas) {
      ro = new ResizeObserver(() => sceneRef.current?.resize());
      ro.observe(canvas);
    }
    return () => { ro?.disconnect(); scene.dispose(); sceneRef.current = null; };
  }, []);

  useEffect(() => { sceneRef.current?.setListening(status === 'listening'); }, [status]);
  useEffect(() => { if (speaking) sceneRef.current?.setSpeaking(); }, [speaking]);

  // Wire real TTS amplitude into the scene's amp driver so the orb reacts to ARIA's voice.
  useEffect(() => { if (ampGetter) sceneRef.current?.setAmpDriver(ampGetter); }, [ampGetter]);

  return <canvas ref={canvasRef} id="space" className="cosmic-canvas" />;
}
