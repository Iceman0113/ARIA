import * as THREE from 'three';

/**
 * Drives the hover tooltip. Returns { update(), dispose() }.
 * Mesh hits → exact userData lookup.
 * Leaf pollen hits → screen-space proximity fallback.
 */
export function createTooltip({ stage, tooltip, camera, hoverables, pollenGeom, leafNodes, leafToPollenIndex, dataNodesById }) {
  const raycaster = new THREE.Raycaster();
  const ndcMouse = new THREE.Vector2();
  let mouseClient = { x: 0, y: 0 };
  let pointerActive = false;

  const onMove = (e) => {
    pointerActive = true;
    const rect = stage.getBoundingClientRect();
    mouseClient.x = e.clientX - rect.left;
    mouseClient.y = e.clientY - rect.top;
    ndcMouse.x = (mouseClient.x / rect.width) * 2 - 1;
    ndcMouse.y = -(mouseClient.y / rect.height) * 2 + 1;
  };
  const onLeave = () => {
    pointerActive = false;
    tooltip.style.display = 'none';
  };
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', onLeave);

  function update() {
    if (!pointerActive) { tooltip.style.display = 'none'; return; }
    raycaster.setFromCamera(ndcMouse, camera);
    const hits = raycaster.intersectObjects(hoverables, false);
    let d = null;
    if (hits.length) {
      d = hits[0].object.userData;
    } else {
      // screen-space proximity for leaves
      let best = null, bestDist = 22;
      const arr = pollenGeom.attributes.position.array;
      for (const lf of leafNodes) {
        const gi = leafToPollenIndex[lf.id];
        if (gi == null) continue;
        const v = new THREE.Vector3(arr[gi*3], arr[gi*3+1], arr[gi*3+2]);
        v.project(camera);
        const sx = (v.x * 0.5 + 0.5) * stage.clientWidth;
        const sy = (-v.y * 0.5 + 0.5) * stage.clientHeight;
        const dx = sx - mouseClient.x, dy = sy - mouseClient.y;
        const dd = Math.sqrt(dx*dx + dy*dy);
        if (dd < bestDist) { bestDist = dd; best = lf; }
      }
      if (best) {
        const parent = dataNodesById[best.parent];
        d = { ...best, _color: parent?.color || '#fff' };
      }
    }
    if (d) {
      tooltip.style.display = 'block';
      const rect = stage.getBoundingClientRect();
      let x = mouseClient.x + 18;
      let y = mouseClient.y + 18;
      if (x > rect.width - 360) x = mouseClient.x - 360;
      if (y > rect.height - 160) y = mouseClient.y - 140;
      tooltip.style.left = x + 'px';
      tooltip.style.top  = y + 'px';
      const lbl = tooltip.querySelector('.label');
      lbl.textContent = d.label;
      lbl.style.color = d._color || '#fff';
      tooltip.querySelector('.detail').textContent = d.detail || '';
      tooltip.querySelector('.freshness').innerHTML =
        `<span class="lime">${d.type}</span> · freshness <span class="lime">${Math.round((d.freshness || 0) * 100)}%</span>`;
      const fill = tooltip.querySelector('.bar .fill');
      fill.style.width = ((d.freshness || 0) * 100) + '%';
      fill.style.background = d._color || '#C5FF4D';
      fill.style.boxShadow  = `0 0 8px ${d._color || '#C5FF4D'}`;
    } else {
      tooltip.style.display = 'none';
    }
  }

  function dispose() {
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerleave', onLeave);
  }

  return { update, dispose };
}
