# Roxy 3D model (Blender)

`views/assets/roxy.glb` is a stylised full-body Roxy Migurdia (Mushoku Tensei) built
procedurally in Blender 5.0 with `build_roxy.py`. The scenes in `views/scene3d.js` load
it, switch it to toon shading with an outline, and animate the `Head`, `Hat` and `Staff` nodes.

Rebuild (Blender's Python module, `pip install bpy==5.0.1` on Python 3.11, plus Pillow):

    python face_texture.py face.png                 # anime face decal
    python build_roxy.py face.png roxy.glb previews # model + Draco GLB + Cycles previews
    cp roxy.glb ../../views/assets/roxy.glb

Or run `build_roxy.py` from Blender's scripting tab after adjusting `sys.argv`.
The character art (`views/assets/roxy/*.webp`) was supplied by the site owner.
