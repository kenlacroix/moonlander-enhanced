// Physics constants — real lunar values where applicable
export const GRAVITY = 97.2; // game units/s² (1.62 * 60, scaled for position integration)
export const THRUST_FORCE = 300.0; // game units/s² (5.0 * 60, scaled for position integration)
export const ROTATION_SPEED = 150; // degrees/second
export const MAX_LANDING_SPEED = 120.0; // game units/s (2.0 * 60, scaled for position integration)
export const MAX_LANDING_ANGLE = 10; // degrees from vertical — above = crash
export const STARTING_FUEL = 1000; // arbitrary fuel units
export const FUEL_BURN_RATE = 30; // units/second while thrusting

// Sprint 7.2 — rigid-body physics (RCS = Reaction Control System, separate
// tank from main fuel, used for attitude/rotation only; mirrors Apollo LM).
export const PHYSICS_V3 = true; // kill switch — flip to false to revert to v2 physics globally
export const ANGULAR_ACCEL = 180; // degrees/sec² from one RCS burn (roughly matches old ROTATION_SPEED feel)
export const MAX_ANGULAR_VEL = 360; // degrees/sec ceiling — prevents integrator runaway
export const MAX_LANDING_ANGULAR_RATE = 8; // degrees/sec — above this at touchdown = crash
export const STARTING_RCS = 100; // units (vs 1000 main fuel) — ~10% ratio
export const RCS_BURN_RATE = 15; // units/sec while RCS firing

// RL reward-structure versioning. Bumped whenever calculateReward changes in a
// way that makes prior weights incompatible. Mismatch on load → force-delete
// weights and retrain from episode 0 (transparent clean slate, not a broken agent).
export const REWARD_VERSION = 3; // Sprint 7.2: terminal reward penalizes touchdown rotation

// Display
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

// Game loop
export const FIXED_TIMESTEP = 1 / 60; // 16.67ms physics step
export const MAX_DELTA = 0.05; // 50ms cap — prevents physics explosion on tab refocus

// Hard cap on flight duration. Primarily a safety net for Apollo 13 "survive"
// missions: even if the target survival window is never reached (bad physics
// corner, infinite hover, etc.), the flight force-terminates. Mirrors
// MAX_STEPS_PER_EPISODE from the training path.
export const MAX_FLIGHT_DURATION = 300; // seconds (5 minutes)

// Terrain generation
export const TERRAIN_POINTS = 200; // number of terrain vertices across the map
export const TERRAIN_ROUGHNESS = 0.6; // midpoint displacement roughness (0-1)
export const WORLD_WIDTH = 4000; // total world width in game units
export const TERRAIN_MIN_HEIGHT = 100; // minimum terrain height from bottom
export const TERRAIN_MAX_HEIGHT = 500; // maximum terrain height from bottom

// Landing pads
export const PAD_MIN_WIDTH = 60;
export const PAD_MAX_WIDTH = 120;
export const PAD_COUNT = 2; // number of pads per terrain

// Lander dimensions
export const LANDER_WIDTH = 30;
export const LANDER_HEIGHT = 36;

// Scoring
export const SCORE_PRECISION_BONUS = 500; // perfect center landing
export const SCORE_FUEL_MULTIPLIER = 0.5; // points per fuel unit remaining
export const SCORE_SPEED_BONUS = 200; // very gentle landing bonus
export const SCORE_ANGLE_BONUS = 100; // near-vertical landing bonus

// Particles
export const MAX_THRUSTER_PARTICLES = 80;
export const MAX_EXPLOSION_PARTICLES = 200;
export const MAX_DUST_PARTICLES = 60;

// Parallax starfield
export const STAR_COUNT_LAYER_1 = 80;
export const STAR_COUNT_LAYER_2 = 50;
export const STAR_COUNT_LAYER_3 = 30;
export const STAR_LAYER_1_SPEED = 0.01;
export const STAR_LAYER_2_SPEED = 0.03;
export const STAR_LAYER_3_SPEED = 0.06;

// Colors
export const COLOR_SKY = "#000000";
export const COLOR_TERRAIN = "#3a3a3a";
export const COLOR_TERRAIN_EDGE = "#5a5a5a";
export const COLOR_PAD = "#00ff88";
export const COLOR_PAD_BEACON = "#00ff88";
export const COLOR_LANDER = "#cccccc";
export const COLOR_LANDER_ACCENT = "#4488ff";
export const COLOR_THRUST = "#ff6600";
export const COLOR_HUD = "#00ff88";
export const COLOR_HUD_WARNING = "#ff4444";
export const COLOR_EXPLOSION = "#ff4400";
export const COLOR_EARTH = "#4488cc";
export const COLOR_ALIEN = "#88ffaa";
export const COLOR_TRACTOR_BEAM = "#44ff88";
