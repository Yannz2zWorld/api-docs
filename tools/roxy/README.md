# Roxy 3D model

`views/assets/roxy.glb` is the full-body Roxy Migurdia (Mushoku Tensei) shown on the login page
and the dashboard.

## Credit and license

The model is a modified version of **"Roxy Migurdia from Mushoku Tensei" by kam**
(https://sketchfab.com/menhankam,
https://sketchfab.com/3d-models/roxy-migurdia-from-mushoku-tensei-5eed685a1ce04d6d9bd4020bd805ca8d),
licensed under **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/).

Changes made here:
- realistic eyes, eyelashes and mouth interior removed; eye/mouth holes filled
- nose, lips and eye sockets smoothed into a flat anime face
- new hand-drawn anime face decal (wink, `face_texture_v4.py`) projected onto the face
- flat anime skin colour, hair recoloured to Roxy's periwinkle blue
- geometry decimated, textures resized to 1024 px WebP, Draco compression

Under ShareAlike, `views/assets/roxy.glb` is distributed under **CC BY-SA 4.0** as well (the
credit is also embedded in the GLB `asset.copyright` field and shown on the pages that display
it). The rest of this repository keeps its own license.

## Rebuild

Blender's Python module (`pip install bpy==5.0.1` on Python 3.11) plus Pillow and NumPy.
Download kam's GLB from Sketchfab first, then:

    python face_texture_v4.py face.png
    python animeify_kam.py roxy_kam.glb face.png roxy.glb [preview_dir]
    cp roxy.glb ../../views/assets/roxy.glb

`views/scene3d.js` renders it with cel shading and an inverted-hull outline. The face decal is
unlit and drawn through the bangs (vertices slide toward the camera along their view ray), as
in anime models.

## Older procedural model

`build_anime.py`, `roxylib.py` and `face_texture_v2.py` build the earlier fully procedural
figure (no third-party assets). They are kept for reference and are not used by the site.

The 2D character art in `views/assets/roxy/*.webp` was supplied by the site owner.
