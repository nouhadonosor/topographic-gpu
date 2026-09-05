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
    const bounds = canvas.getBoundingClientRect();
    const cursorX = (event.clientX - bounds.left) * canvas.width / bounds.width;
    const cursorY = canvas.height - (event.clientY - bounds.top) * canvas.height / bounds.height;
    const scaleRatio = nextScale / previousValue;
    panOffset.x += (cursorX - options.padding - panOffset.x) * (1 - scaleRatio);
    panOffset.y += (cursorY - options.padding - panOffset.y) * (1 - scaleRatio);
    syncPanOptions();
    noiseScale.value = nextScale;
    noiseScale.dispatchEvent(new Event('input', { bubbles: true }));
  }, { passive: false });

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    dragStart = { x: event.clientX, y: event.clientY };
    canvas.classList.add('is-panning');
  });

  canvas.addEventListener('pointermove', event => {
    if (!dragStart) return;
    const bounds = canvas.getBoundingClientRect();
    panOffset.x += (event.clientX - dragStart.x) * canvas.width / bounds.width;
    panOffset.y += (event.clientY - dragStart.y) * canvas.height / bounds.height;
    dragStart = { x: event.clientX, y: event.clientY };
    if (!document.querySelector('#animate').checked && !recording) render(performance.now());
  });

  const stopPanning = event => {
    if (!dragStart) return;
    dragStart = null;
    canvas.classList.remove('is-panning');
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    syncPanOptions();
    void writeOptionsToUrl(options);
  };
  canvas.addEventListener('pointerup', stopPanning);
  canvas.addEventListener('pointercancel', stopPanning);

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