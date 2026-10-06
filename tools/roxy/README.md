# Roxy 3D model (Blender)

`views/assets/roxy.glb` is an anime-style full-body Roxy Migurdia (Mushoku Tensei) following
the owner's turnaround reference. It is built procedurally in Blender 5 with `build_anime.py`:
- long tan coat with white trim and a layered capelet, navy cuffs
- navy dress with gold straps and buttons, pleated skirt with frill
- black socks and white knee boots
- pointed Migurd ears, blue hair with ahoge and two long braids
- an anime face decal from `face_texture_v2.py`
- a glossy display disc

Soft ambient occlusion and a hair gradient are baked into vertex colours. `views/scene3d.js`
renders it with 3-step cel shading and an outline, and animates the `Head` node.

Rebuild (Blender's Python module `pip install bpy==5.0.1` on Python 3.11, plus Pillow):

    python face_texture_v2.py face.png
    python build_anime.py face.png roxy.glb previews   # model + Draco GLB + Cycles previews
    cp roxy.glb ../../views/assets/roxy.glb

`roxylib.py` holds the shared mesh helpers (skin bodies, lathes, swept strands, ellipsoids).
The 2D character art in `views/assets/roxy/*.webp` was supplied by the site owner.
