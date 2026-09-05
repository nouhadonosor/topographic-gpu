async function initialize() {
  const canvas = document.querySelector('#preview');
  const error = document.querySelector('#error');
  await initializeTheme();
  let renderer;
  try {
    renderer = new WebGLTopographicRenderer(canvas);
  } catch (cause) {
    error.textContent = cause.message;
    error.hidden = false;
    return;
  }

  const options = await getOptionsFromUrl();
  const recordingStatus = document.querySelector('#recording-status');
  const resolutionPreset = document.querySelector('#resolution-preset');
  const animate = document.querySelector('#animate');
  const duration = document.querySelector('#duration');
  const closestResolutionPreset = getClosestResolutionPreset(options.width, options.height);
  let applyingResolutionPreset = false;
  let animationFrame = 0;
  let startedAt = performance.now();
  let recording = false;
  const panOffset = { x: options.panX, y: options.panY };
  let dragStart = null;
  let activePanInput = null;
  let pinchDistance = null;
  let pinchMidpoint = null;

  const syncCanvasSize = () => {
    canvas.width = options.width;
    canvas.height = options.height;
  };

  const render = now => {
    const started = performance.now();
    const isAnimating = document.querySelector('#animate').checked || recording;
    const elapsedSeconds = isAnimating ? (now - startedAt) / 1000 : 0;
    renderer.render(options, elapsedSeconds, panOffset, options.evolveLoopDuration);
    document.querySelector('#render-time').textContent = `${(performance.now() - started).toFixed(1)} ms`;
    if (document.querySelector('#animate').checked || recording) animationFrame = requestAnimationFrame(render);
  };

  const syncPanOptions = () => {
    options.panX = panOffset.x;
    options.panY = panOffset.y;
  };

  animate.checked = options.animate;
  duration.value = options.duration;

  initializeGradientControls({
    options,
    onChange: () => {
      void writeOptionsToUrl(options);
      if (!document.querySelector('#animate').checked && !recording) render(performance.now());
    }
  });

  const animationMode = document.querySelector('#animation-mode');
  const evolveLoopField = document.querySelector('#evolve-loop-field');
  const updateEvolveLoopVisibility = () => {
    evolveLoopField.hidden = animationMode.value !== 'evolve';
  };
  animationMode.value = options.animationMode;
  updateEvolveLoopVisibility();
  animationMode.addEventListener('change', () => {
    options.animationMode = animationMode.value;
    void writeOptionsToUrl(options);
    updateEvolveLoopVisibility();
    if (!document.querySelector('#animate').checked && !recording) render(performance.now());
  });

  document.querySelectorAll('[data-option]').forEach(input => {
    const key = input.dataset.option;
    input.value = options[key];
    const valueInput = document.querySelector(`[data-value="${key}"]`);
    const colorInput = document.querySelector(`[data-color-value="${key}"]`);
    if (valueInput) valueInput.value = options[key];
    if (colorInput) colorInput.value = options[key];
    input.addEventListener('input', () => {
      options[key] = input.type === 'color' ? input.value : Number(input.value);
      if (valueInput) {
        valueInput.value = input.value;
        valueInput.setAttribute('aria-invalid', 'false');
      }
      if (colorInput) colorInput.value = input.value;
      if ((key === 'width' || key === 'height') && !applyingResolutionPreset) resolutionPreset.value = 'custom';
      if (key === 'width' || key === 'height') syncCanvasSize();
      void writeOptionsToUrl(options);
      if (!document.querySelector('#animate').checked && !recording) render(performance.now());
    });
  });

  const zoomAtPoint = (clientX, clientY, nextScale) => {
    const noiseScale = document.querySelector('[data-option="noiseScale"]');
    const previousValue = Number(noiseScale.value);
    const bounds = canvas.getBoundingClientRect();
    const cursorX = (clientX - bounds.left) * canvas.width / bounds.width;
    const cursorY = canvas.height - (clientY - bounds.top) * canvas.height / bounds.height;
    const scaleRatio = nextScale / previousValue;
    panOffset.x += (cursorX - options.padding - panOffset.x) * (1 - scaleRatio);
    panOffset.y += (cursorY - options.padding - panOffset.y) * (1 - scaleRatio);
    noiseScale.value = nextScale;
    noiseScale.dispatchEvent(new Event('input', { bubbles: true }));
  };

  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const noiseScale = document.querySelector('[data-option="noiseScale"]');
    const minimum = Number(noiseScale.min);
    const maximum = Number(noiseScale.max);
    const step = Number(noiseScale.step);
    const previousValue = Number(noiseScale.value);
    const nextValue = previousValue * Math.exp(-event.deltaY * 0.001);
    const steppedValue = Math.round((nextValue - minimum) / step) * step + minimum;
    const nextScale = Math.min(maximum, Math.max(minimum, steppedValue));
    zoomAtPoint(event.clientX, event.clientY, nextScale);
    syncPanOptions();
  }, { passive: false });

  const beginPanning = (clientX, clientY, inputType) => {
    if (activePanInput && activePanInput !== inputType) return;
    activePanInput = inputType;
    dragStart = { x: clientX, y: clientY };
    canvas.classList.add('is-panning');
  };

  const movePanning = (clientX, clientY) => {
    if (!dragStart) return;
    const bounds = canvas.getBoundingClientRect();
    panOffset.x += (clientX - dragStart.x) * canvas.width / bounds.width;
    panOffset.y += (clientY - dragStart.y) * canvas.height / bounds.height;
    dragStart = { x: clientX, y: clientY };
    if (!document.querySelector('#animate').checked && !recording) render(performance.now());
  };

  const finishPanning = (inputType, pointerId) => {
    if (activePanInput !== inputType) return;
    dragStart = null;
    activePanInput = null;
    pinchDistance = null;
    pinchMidpoint = null;
    canvas.classList.remove('is-panning');
    if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    syncPanOptions();
    void writeOptionsToUrl(options);
  };

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.pointerType === 'touch') return;
    canvas.setPointerCapture(event.pointerId);
    beginPanning(event.clientX, event.clientY, 'pointer');
  });

  canvas.addEventListener('pointermove', event => {
    if (activePanInput !== 'pointer') return;
    movePanning(event.clientX, event.clientY);
  });

  const stopPanning = event => {
    finishPanning('pointer', event.pointerId);
  };
  canvas.addEventListener('pointerup', stopPanning);
  canvas.addEventListener('pointercancel', stopPanning);

  const getTouchDistance = touches => {
    const x = touches[1].clientX - touches[0].clientX;
    const y = touches[1].clientY - touches[0].clientY;
    return Math.hypot(x, y);
  };

  const getTouchMidpoint = touches => ({
    x: (touches[0].clientX + touches[1].clientX) * 0.5,
    y: (touches[0].clientY + touches[1].clientY) * 0.5
  });

  const beginPinching = touches => {
    if (activePanInput && activePanInput !== 'touch') return;
    activePanInput = 'touch';
    dragStart = null;
    pinchDistance = getTouchDistance(touches);
    pinchMidpoint = getTouchMidpoint(touches);
    canvas.classList.remove('is-panning');
  };

  const movePinching = touches => {
    if (!pinchDistance || !pinchMidpoint) return;
    const nextDistance = getTouchDistance(touches);
    const nextMidpoint = getTouchMidpoint(touches);
    const noiseScale = document.querySelector('[data-option="noiseScale"]');
    const minimum = Number(noiseScale.min);
    const maximum = Number(noiseScale.max);
    const nextScale = Math.min(maximum, Math.max(minimum, Number(noiseScale.value) * nextDistance / pinchDistance));
    const bounds = canvas.getBoundingClientRect();
    panOffset.x += (nextMidpoint.x - pinchMidpoint.x) * canvas.width / bounds.width;
    panOffset.y += (nextMidpoint.y - pinchMidpoint.y) * canvas.height / bounds.height;
    zoomAtPoint(nextMidpoint.x, nextMidpoint.y, nextScale);
    pinchDistance = nextDistance;
    pinchMidpoint = nextMidpoint;
    syncPanOptions();
    void writeOptionsToUrl(options);
  };

  canvas.addEventListener('touchstart', event => {
    if (event.touches.length === 2) {
      event.preventDefault();
      beginPinching(event.touches);
      return;
    }
    if (event.touches.length !== 1) return;
    event.preventDefault();
    const touch = event.touches[0];
    beginPanning(touch.clientX, touch.clientY, 'touch');
  }, { passive: false });

  canvas.addEventListener('touchmove', event => {
    if (activePanInput !== 'touch') return;
    event.preventDefault();
    if (event.touches.length === 2) {
      if (!pinchDistance) beginPinching(event.touches);
      movePinching(event.touches);
      return;
    }
    if (event.touches.length !== 1) {
      finishPanning('touch');
      return;
    }
    const touch = event.touches[0];
    movePanning(touch.clientX, touch.clientY);
  }, { passive: false });

  const stopTouchPanning = event => {
    if (activePanInput !== 'touch') return;
    event.preventDefault();
    if (event.type === 'touchend' && event.touches.length === 1) {
      pinchDistance = null;
      pinchMidpoint = null;
      const touch = event.touches[0];
      dragStart = { x: touch.clientX, y: touch.clientY };
      canvas.classList.add('is-panning');
      return;
    }
    finishPanning('touch');
  };
  canvas.addEventListener('touchend', stopTouchPanning, { passive: false });
  canvas.addEventListener('touchcancel', stopTouchPanning, { passive: false });

  resolutionPreset.addEventListener('change', () => {
    const dimensions = resolutionPresets[resolutionPreset.value];
    if (!dimensions) return;
    applyingResolutionPreset = true;
    ['width', 'height'].forEach((key, index) => {
      const slider = document.querySelector(`[data-option="${key}"]`);
      slider.value = dimensions[index];
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    applyingResolutionPreset = false;
  });

  resolutionPreset.value = closestResolutionPreset;
  if (!new URLSearchParams(window.location.search).has('settings')) resolutionPreset.dispatchEvent(new Event('change'));

  const copyLink = document.querySelector('#copy-link');
  copyLink.addEventListener('click', async () => {
    await writeOptionsToUrl(options);
    await navigator.clipboard.writeText(window.location.href);
    copyLink.textContent = 'Link copied';
    setTimeout(() => { copyLink.textContent = 'Copy link'; }, 1400);
  });

  document.querySelectorAll('[data-value]').forEach(input => {
    const key = input.dataset.value;
    const slider = document.querySelector(`[data-option="${key}"]`);
    input.addEventListener('input', () => {
      const value = Number(input.value);
      const minimum = Number(slider.min);
      const maximum = Number(slider.max);
      const valid = isCompleteNumber(input.value) && value >= minimum && value <= maximum;
      input.setAttribute('aria-invalid', String(!valid));
      if (!valid) return;
      options[key] = value;
      slider.value = input.value;
      if (key === 'width' || key === 'height') syncCanvasSize();
      void writeOptionsToUrl(options);
      if (!document.querySelector('#animate').checked && !recording) render(performance.now());
    });
    input.addEventListener('blur', () => {
      if (input.getAttribute('aria-invalid') !== 'true') return;
      input.value = options[key];
      input.setAttribute('aria-invalid', 'false');
    });
  });

  document.querySelectorAll('[data-color-value]').forEach(input => {
    const key = input.dataset.colorValue;
    const swatch = document.querySelector(`[data-option="${key}"]`);
    input.addEventListener('input', () => {
      const value = normalizeHex(input.value);
      input.setAttribute('aria-invalid', String(!value));
      if (!value) return;
      options[key] = value;
      swatch.value = value;
      void writeOptionsToUrl(options);
      if (!document.querySelector('#animate').checked && !recording) render(performance.now());
    });
    input.addEventListener('blur', () => {
      if (input.getAttribute('aria-invalid') !== 'true') return;
      input.value = options[key];
      input.setAttribute('aria-invalid', 'false');
    });
  });

  animate.addEventListener('change', event => {
    options.animate = event.target.checked;
    void writeOptionsToUrl(options);
    cancelAnimationFrame(animationFrame);
    startedAt = performance.now();
    render(startedAt);
  });

  duration.addEventListener('input', () => {
    const value = Number(duration.value);
    if (!Number.isFinite(value) || value < 1 || value > 30) return;
    options.duration = value;
    void writeOptionsToUrl(options);
  });

  document.querySelector('#save-image').addEventListener('click', () => {
    render(performance.now());
    saveCanvasImage(canvas);
  });

  document.querySelector('#save-video').addEventListener('click', () => {
    if (recording) return;
    const button = document.querySelector('#save-video');
    const duration = Math.min(30, Math.max(1, Number(document.querySelector('#duration').value)));
    const recorder = recordCanvasVideo({
      canvas,
      duration,
      bitrate: options.videoBitrate,
      onProgress: progress => {
        recordingStatus.querySelector('output').value = `Recording ${progress}%`;
      },
      onStart: () => {
        recording = true;
        button.disabled = true;
        button.textContent = 'Recording...';
        recordingStatus.hidden = false;
        startedAt = performance.now();
        cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(render);
      },
      onBeforeStop: () => render(startedAt + duration * 1000),
      onStop: () => {
        recording = false;
        button.disabled = false;
        button.textContent = 'Record video';
        recordingStatus.hidden = true;
        if (!document.querySelector('#animate').checked) cancelAnimationFrame(animationFrame);
      },
      onError: message => {
        error.textContent = message;
        error.hidden = false;
      }
    });
    if (!recorder) return;
  });

  render(performance.now());
}

window.addEventListener('DOMContentLoaded', initialize);