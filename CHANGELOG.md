# Changelog

All notable changes to MoonLander Enhanced will be documented in this file.

## [0.1.0.0] - 2026-04-13

### Added
- Playable Moon Lander game with real lunar gravity (1.62 m/s²), thrust, and rotation controls
- Procedural terrain generation using midpoint displacement with seeded RNG
- Landing pad placement with safe-landing detection (speed and angle thresholds)
- Crash detection on terrain and pads with explosion particle effects
- Telemetry HUD showing altitude, vertical/horizontal speed, fuel, and angle
- Thruster exhaust particle system with directional emission
- Landing dust burst on touchdown
- Parallax starfield background with 3 depth layers and Earth rise
- Keyboard controls (arrow keys for thrust/rotate, R to restart)
- Scoring system with fuel, speed, and angle bonuses
- Fixed timestep physics loop with delta-time capping
- Camera system with smooth follow and screen shake on crash
- 36 unit tests covering physics, vector math, terrain interpolation, collision, and angle normalization
- Biome linter and knip dead code detection
- Code health dashboard via /health

### Fixed
- Camera smoothing now uses framerate-independent exponential decay
- Position integration no longer bakes in 60fps assumption
- Angle normalization handles arbitrary rotation values correctly
- Landing pad detection uses center-point overlap instead of full containment
- Score angle bonus uses proper angle normalization
