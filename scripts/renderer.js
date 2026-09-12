class WebGLTopographicRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true
    });
    if (!this.gl) throw new Error('WebGL 2 is unavailable in this browser.');
    this.gl.disable(this.gl.DITHER);

    const vertexShader = this.compile(this.gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compile(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = this.gl.createProgram();
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);
    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      throw new Error(this.gl.getProgramInfoLog(this.program));
    }

    const vertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
    const position = this.gl.getAttribLocation(this.program, 'position');
    this.gl.enableVertexAttribArray(position);
    this.gl.vertexAttribPointer(position, 2, this.gl.FLOAT, false, 0, 0);
    this.uniforms = {};
  }

  compile(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(this.gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  uniform(name) {
    if (!this.uniforms[name]) this.uniforms[name] = this.gl.getUniformLocation(this.program, name);
    return this.uniforms[name];
  }

  render(options, elapsedSeconds, panOffset, loop = { enabled: false, duration: 1 }) {
    if (this.canvas.width !== options.width || this.canvas.height !== options.height) {
      this.canvas.width = options.width;
      this.canvas.height = options.height;
    }
    const gl = this.gl;
    gl.viewport(0, 0, options.width, options.height);
    gl.useProgram(this.program);
    gl.uniform2f(this.uniform('resolution'), options.width, options.height);
    ['padding', 'lineWidth', 'cellSize', 'noiseScale', 'persistence', 'octaves', 'sigmoidIntensity',
      'contourDensity', 'thresholdRange', 'animationSpeed', 'seed'].forEach(name => {
      gl.uniform1f(this.uniform(name), options[name]);
    });
    gl.uniform1i(this.uniform('perfectLoop'), loop.enabled ? 1 : 0);
    gl.uniform1f(this.uniform('loopDuration'), loop.duration);
    gl.uniform1i(this.uniform('animationMode'), animationModeIds[options.animationMode] ?? 0);
    gl.uniform2f(this.uniform('panOffset'), panOffset.x, panOffset.y);
    gl.uniform1f(this.uniform('time'), elapsedSeconds);
    gl.uniform4fv(this.uniform('backgroundColor'), hexToRgba(options.background));
    gl.uniform4fv(this.uniform('fillColor'), hexToRgba(options.fill));
    gl.uniform4fv(this.uniform('contourColor'), hexToRgba(options.contour));
    gl.uniform1i(this.uniform('gradientEnabled'), options.gradientEnabled ? 1 : 0);
    gl.uniform1i(this.uniform('gradientStopCount'), options.gradientStops.length);
    const gradientPositions = new Float32Array(8);
    const gradientColors = new Float32Array(8 * 4);
    options.gradientStops.forEach((stop, index) => {
      gradientPositions[index] = stop.position;
      gradientColors.set(hexToRgba(stop.color), index * 4);
    });
    gl.uniform1fv(this.uniform('gradientPositions'), gradientPositions);
    gl.uniform4fv(this.uniform('gradientColors'), gradientColors);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
