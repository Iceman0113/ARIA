import { useEffect, useRef } from 'react';
import { createScene } from './scene.js';

export default function CosmicStage({ status = 'idle', speaking = false }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    sceneRef.current = createScene(canvasRef.current);
    return () => { sceneRef.current?.dispose(); sceneRef.current = null; };
  }, []);

  useEffect(() => { sceneRef.current?.setListening(status === 'listening'); }, [status]);
  useEffect(() => { if (speaking) sceneRef.current?.setSpeaking(); }, [speaking]);

  return <canvas ref={canvasRef} id="space" className="cosmic-canvas" />;
}
