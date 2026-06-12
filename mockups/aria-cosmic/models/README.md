# ARIA's 3D model — drop-in

Put ARIA's real 3D model here as:

    models/aria.glb

As soon as that file exists and you reload, it **auto-replaces the placeholder
helmet** in the center. If it's missing, the prototype falls back to the
DamagedHelmet placeholder. The scene auto-centers and auto-scales whatever model
you provide (fit to ~3.6 units), so you don't need to worry about export scale.
If your .glb has an animation clip, the first one plays as an idle loop.

## How to make ARIA's model (image-to-3D)
1. Generate an ARIA character portrait (teal "her" version — same style as the
   six agents, but ARIA's signature teal/lime). Front-facing, plain background
   works best for image-to-3D.
2. Run it through an image-to-3D tool that exports **.glb**:
   - Meshy.ai  ·  Tripo (tripo3d.ai)  ·  Luma Genie  ·  Stable Fast 3D
3. Download the .glb, rename to `aria.glb`, drop it in this folder, reload.

Tips: a bust/head-and-shoulders model reads best at center; keep polycount
reasonable (a few hundred KB–few MB). GLB (binary, textures embedded) is preferred
over GLTF+separate textures.
