const vertexShaderSource = `#version 300 es
in vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;

uniform vec2 resolution;
uniform float padding;
uniform float time;
uniform float noiseScale;
uniform float persistence;
uniform float octaves;
uniform float sigmoidIntensity;
uniform float contourDensity;
uniform float thresholdRange;
uniform float animationSpeed;
uniform float evolveLoopDuration;
uniform int animationMode;
uniform float seed;
uniform float lineWidth;
uniform float cellSize;
uniform vec2 panOffset;
uniform vec4 backgroundColor;
uniform vec4 fillColor;
uniform vec4 contourColor;
uniform bool gradientEnabled;
uniform int gradientStopCount;
uniform float gradientPositions[8];
uniform vec4 gradientColors[8];

out vec4 outputColor;

vec3 randomGradient(vec3 cell) {
  vec3 value = sin(vec3(
    dot(cell, vec3(127.1, 311.7, 74.7)),
    dot(cell, vec3(269.5, 183.3, 246.1)),
    dot(cell, vec3(113.5, 271.9, 124.6))
  ) + seed) * 43758.5453;
  vec3 gradient = fract(value) * 2.0 - 1.0;
  return gradient * inversesqrt(max(dot(gradient, gradient), 0.000001));
}

float simplexNoise(vec3 point) {
  vec3 cell = floor(point);
  vec3 offset = fract(point);
  vec3 blend = offset * offset * offset * (offset * (offset * 6.0 - 15.0) + 10.0);

  float lowerNear = mix(
    dot(randomGradient(cell), offset),
    dot(randomGradient(cell + vec3(1.0, 0.0, 0.0)), offset - vec3(1.0, 0.0, 0.0)),
    blend.x
  );
  float lowerFar = mix(
    dot(randomGradient(cell + vec3(0.0, 1.0, 0.0)), offset - vec3(0.0, 1.0, 0.0)),
    dot(randomGradient(cell + vec3(1.0, 1.0, 0.0)), offset - vec3(1.0, 1.0, 0.0)),
    blend.x
  );
  float upperNear = mix(
    dot(randomGradient(cell + vec3(0.0, 0.0, 1.0)), offset - vec3(0.0, 0.0, 1.0)),
    dot(randomGradient(cell + vec3(1.0, 0.0, 1.0)), offset - vec3(1.0, 0.0, 1.0)),
    blend.x
  );
  float upperFar = mix(
    dot(randomGradient(cell + vec3(0.0, 1.0, 1.0)), offset - vec3(0.0, 1.0, 1.0)),
    dot(randomGradient(cell + vec3(1.0, 1.0, 1.0)), offset - vec3(1.0, 1.0, 1.0)),
    blend.x
  );
  return mix(mix(lowerNear, lowerFar, blend.y), mix(upperNear, upperFar, blend.y), blend.z);
}

float fractalNoise(vec2 point, float frameTime) {
  float sum = 0.0;
  float weight = 0.0;
  float amplitude = 1.0;
  float frequency = 1.0;
  for (int octave = 0; octave < 20; octave++) {
    if (float(octave) >= octaves) break;
    sum += simplexNoise(vec3(point * frequency, float(octave) + frameTime)) * amplitude;
    weight += amplitude;
    amplitude *= persistence;
    frequency *= 2.0;
  }
  float normalized = sum / max(weight, 0.0001);
  return 2.0 / (1.0 + exp(-sigmoidIntensity * normalized)) - 1.0;
}

float loopedFractalNoise(vec2 point, float loopPhase) {
  const float TAU = 6.28318530718;
  float angle = loopPhase * TAU;
  float sum = 0.0;
  float weight = 0.0;
  float amplitude = 1.0;
  float frequency = 1.0;
  for (int octave = 0; octave < 20; octave++) {
    if (float(octave) >= octaves) break;
    float octaveOffset = float(octave);
    sum += simplexNoise(vec3(point * frequency, octaveOffset * 1.7)) * amplitude;
    weight += amplitude;
    amplitude *= persistence;
    frequency *= 2.0;
  }
  float normalized = sum / max(weight, 0.0001);
  float evolution = sin(angle + normalized * 2.4) * 0.15;
  float evolved = normalized + evolution;
  return 2.0 / (1.0 + exp(-sigmoidIntensity * evolved)) - 1.0;
}

vec2 rotatePoint(vec2 point, float angle) {
  mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  return rotation * point;
}

vec2 animatePoint(vec2 point, float motionTime) {
  if (animationMode == 1) {
    return point + vec2(motionTime * 0.12, motionTime * 0.08);
  }
  if (animationMode == 3) {
    float breathing = 1.0 + sin(motionTime) * 0.12;
    return point / breathing;
  }
  if (animationMode == 4) {
    float warpTime = motionTime * 0.35;
    vec2 warp = vec2(
      simplexNoise(vec3(point * 0.7, warpTime)),
      simplexNoise(vec3(point * 0.7 + 17.0, warpTime + 9.0))
    );
    return point + warp * 0.55;
  }
  if (animationMode == 5) {
    return rotatePoint(point, motionTime * 0.12);
  }
  return point;
}

vec4 getLandColor(float value) {
  if (!gradientEnabled || gradientStopCount < 1) return fillColor;
  float height = value * 0.5 + 0.5;
  if (height <= gradientPositions[0]) return gradientColors[0];
  for (int index = 1; index < 8; index++) {
    if (index >= gradientStopCount) break;
    if (height <= gradientPositions[index]) {
      float interval = max(gradientPositions[index] - gradientPositions[index - 1], 0.0001);
      float amount = (height - gradientPositions[index - 1]) / interval;
      return mix(gradientColors[index - 1], gradientColors[index], amount);
    }
  }
  return gradientColors[gradientStopCount - 1];
}

void main() {
  vec2 pixel = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y);
  bool inside = pixel.x >= padding && pixel.y >= padding &&
    pixel.x <= resolution.x - padding && pixel.y <= resolution.y - padding;
  if (!inside) {
    outputColor = backgroundColor;
    return;
  }

  float motionTime = time * animationSpeed;
  vec2 point = (pixel - padding - panOffset) / max(noiseScale * cellSize, 0.25);
  point = animatePoint(point, motionTime);
  float value;
  if (animationMode == 0) {
    float loopPhase = fract(motionTime / max(evolveLoopDuration, 0.001));
    value = loopedFractalNoise(point, loopPhase);
  } else {
    value = fractalNoise(point, 0.0);
  }
  float fillThreshold = -1.0 + thresholdRange * 2.0;
  if (animationMode == 2) fillThreshold += sin(motionTime) * 0.12;
  float valueGradient = max(fwidth(value), 0.000001);
  float fillCoverage = 1.0 - smoothstep(
    fillThreshold - valueGradient * 0.5,
    fillThreshold + valueGradient * 0.5,
    value
  );
  vec4 color = mix(backgroundColor, getLandColor(value), fillCoverage);

  float density = max(contourDensity, 1.0);
  float scaledValue = (value + 1.0) * density;
  float contourDistance = abs(fract(scaledValue + 0.5) - 0.5);
  float scaledGradient = max(fwidth(scaledValue), 0.000001);
  float contourWidth = max(lineWidth * 0.5, 0.25) * scaledGradient;
  float contourCoverage = 1.0 - smoothstep(contourWidth, contourWidth + scaledGradient, contourDistance);
  float maximumScaledValue = thresholdRange * 2.0 * density;
  if (scaledValue >= 0.0 && scaledValue <= maximumScaledValue) {
    color = mix(color, contourColor, contourCoverage);
  }
  outputColor = color;
}`;
