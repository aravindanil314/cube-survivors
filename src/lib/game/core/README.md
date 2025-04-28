# Game Object Pooling System

This directory contains an object pooling system designed to improve game performance by efficiently reusing game objects.

## Components

- **ObjectPool**: Generic class for pooling any type of object
- **GameObject**: Base interface and class for all game objects
- **GameObjectFactory**: Creates and manages game objects from their respective pools

## Benefits

- Reduces garbage collection pauses
- Minimizes memory fragmentation
- Improves CPU usage
- Efficiently manages THREE.js resources

See `GameObjectIntegration.ts` for integration examples.
