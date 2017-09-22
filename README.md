# mkjs
![mkscrn2s](https://cloud.githubusercontent.com/assets/6294155/25496279/34c8808c-2b78-11e7-90ee-b0d1350244bb.png)
**mkjs** is an experimental javascript engine reimplemention of Mario Kart DS. Users of the application must provide their own Mario Kart DS ROM, dumped using a DS or 3DS. This project exists for entirely educational purposes.

If you have a ROM of MKDS available, you can give mkjs a shot here:
http://riperiperi.github.io/mkjs

# Purpose
I started working on mkjs a few years ago to get a better grasp on a lot things, mainly for fun. Here are the key factors:

- WebGL game engine with no dependancies. Entirely written using vanilla Javascript ES5. (will not accept contributions using libraries!)
   - (exception is GLMatrix, which is required for matrix and vector operations)
- Entirely implement readers for NDS file formats, and ways to utilise them in an actual game environment.
- SSEQ (midi) music and sfx player using Web Audio API features. Supports 3D sound, and used to support doppler...
- Custom simple collision engine with swept sphere collision against quadtree partitioned triangle collision meshes. Performs well enough in javascript, but could likely be faster.
- Attempts to replicate the perfect physics and feeling of this beautiful game, through format and physics reverse engineering.
- Very clean "class" structure in ES5. ES6 port would be welcome, I might do that at some point.
- Works on many platforms, including iOS at 60 fps!

# Current Features
The base game mostly works. A lot of the grunt work is done - the current setup shows a good prototype of the game working.

- Nitro filesystem management for real .nds files, allowing a ROM to be provided with no changes.
- Loads and displays all courses (including battle) in some playable form. Textures, texture animations are intact.
- Functional Kart vs. World physics, using kcl files for courses.
- Work in progress Kart vs. Moving object physics (see Tick Tock Clock, Bowser's Castle DS)
- Functional AI karts that follow the same waypoints as MKDS AI. (battle and race AI modes)
- Content system for work in progress course objects, eg. routed car obstacles, moving platforms.

# Possible Future
- UI engine
- Race Logic (checkpoints, lap count, lap tracking, race completion...)
- All course obstacles (enemies, bridge in delfino)
- All road collision types (loop, sticky not yet implemented)
- Items & damage
- Particle effects format reader and renderer (no idea how these formats work).
- Custom Menus
- Battle Mode & Mission Mode
- Multiplayer (custom courses? >8 players?)
- Lots of bug fixes for collisions and format readers!

# Multiplayer
![mkmulti](https://cloud.githubusercontent.com/assets/6294155/25496283/3c681532-2b78-11e7-86a1-9f710a9fae19.png)

While multiplayer using a Websockets server is semi-functional, it is very simplistic and only exists for testing purposes. A future implementation would ideally connect to peers using WebRTC rather than connecting through a central server.
