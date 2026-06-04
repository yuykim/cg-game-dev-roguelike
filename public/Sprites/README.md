# WebGL Sprite Assets

This folder is served directly by Vite. Use `/Sprites/...` URLs from browser code.

## Manifests

- `atlas-manifest.json`: Aseprite-style packed atlas files.
- `frames-manifest.json`: Individual PNG frame sequences grouped by folder.

## Notes

- Unity `.meta` files were removed. They are not used by WebGL.
- `PlayerCombatSheet` was split because the original sheet was `960x4368`, which can exceed a `4096` WebGL max texture limit.
- For pixel-art rendering, use nearest filtering, clamp wrapping, and disable mipmaps.

