# Fireworks — Bullet Time

A 3D fireworks simulator with a "bullet-time" feature. Watch continuous fireworks launch and explode in vibrant colors, then drag to orbit the camera and freeze time — fly around the frozen explosions in slow motion.

[fireworks.webm](https://github.com/user-attachments/assets/e3f58644-1c20-4045-92f4-9014a5336d90)

## Features

- Continuous fireworks with vibrant HSL-based colors and trailing embers
- **Bullet-time**: drag to rotate the camera and the simulation drops to 3% speed
- Fly around the frozen scene, then release — time resumes after 2 seconds
- WASD/arrow keys to pan through the scene (also triggers bullet-time)
- Scroll to zoom with no limits
- Procedural threadbare evergreen trees and starfield backdrop
- Additive-blended particle system with up to 120k particles

## Running

Requires a local HTTP server (ES modules need it):

```sh
npx serve .
```

Then open `http://localhost:3000`.

## Controls

| Input | Action |
|---|---|
| Drag | Orbit camera + enter bullet-time |
| Scroll | Zoom in/out |
| W / Up | Move up |
| S / Down | Move down |
| A / Left | Strafe left |
| D / Right | Strafe right |

## Tech

Built with [Three.js](https://threejs.org/) (r164). Single `fireworks.js` file, no build step.
