# Triple T

A third-person backrooms survival game built with three.js. You're lost in procedurally generated
backrooms while **Tung Tung Tung Sahur** hunts you. Survive as long as you can.

## Run it

ES modules need to be served over HTTP (opening `index.html` from disk won't work):

```bash
python3 serve.py
```

(`serve.py` is a tiny static server that disables browser caching, so changes always show up on reload.)

Then open http://localhost:8765. three.js loads from the jsDelivr CDN, so you need an internet connection.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move |
| Mouse | Look (click the game to lock the cursor) |
| Shift | Naruto run (unlimited) |
| Esc / P | Pause |

## How it plays

- Pick **Chomp**, **Pechar** or **Li** on the menu. Each is a stylized model based on the photos in `Images/<name>/`.
- Tung hunts you from the very first second. He spawns far away, pops a **!**, yells "tung tung tung… sahur!" (browser speech), and comes straight for you.
- He always knows where you are, so you can't hide. You can only outrun him: your Naruto run is unlimited and faster than he is.
- The chase music plays the whole run. The meter at the bottom shows how far away he is, and you can hear his wooden "tung tung tung" knocks in 3D.
- Your character narrates in speech bubbles: calm when he's far, panicking when he's close, smug after a close call.
- If he catches you, you get a jumpscare, then a death screen with stats and a rank.
- Joke posters are taped around the backrooms. Your best time is saved in the browser.

Tuning: Tung's speed and spawn windup are `CHASE_SPEED` / `WINDUP` in `src/tung.js`; your speeds are `WALK` / `SPRINT` in `src/main.js`.
Voice lines for each avatar are in `src/avatars.js` (`lines`).

## Code layout

- `src/main.js`: menu, game loop, player controller, third-person camera, HUD, jumpscare
- `src/world.js`: backrooms generation (maze, halls, pillars), collision, line of sight, pathfinding, lights
- `src/tung.js`: the Tung model and his AI (windup, then a nonstop chase)
- `src/avatars.js`: the three player avatars and their walk animation
- `src/audio.js`: chase music, positional knocks, fluorescent hum, footsteps, jumpscare sounds
- `src/textures.js`: procedural canvas textures (wallpaper, carpet, ceiling, wood, shirt prints)
