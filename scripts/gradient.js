const maxGradientStops = 8;

function initializeGradientControls({ options, onChange }) {
  const enabledInput = document.querySelector('#gradient-enabled');
  const preview = document.querySelector('#gradient-preview');
  const editor = document.querySelector('#gradient-editor');
  const addButton = document.querySelector('#add-gradient-stop');
  const countOutput = document.querySelector('#gradient-stop-count');

  const updatePreview = () => {
    preview.style.background = `linear-gradient(to right, ${options.gradientStops.map(stop => `${stop.color} ${stop.position * 100}%`).join(', ')})`;
  };

  const update = () => {
    options.gradientEnabled = enabledInput.checked;
    onChange();
  };

  const renderStops = () => {
    updatePreview();
    editor.replaceChildren();
    options.gradientStops.forEach((stop, index) => {
      const row = document.createElement('div');
      row.className = 'gradient-stop';

      const heading = document.createElement('div');
      heading.className = 'gradient-stop-heading';
      const label = document.createElement('span');
      label.textContent = `Stop ${index + 1}`;
      const removeButton = document.createElement('button');
      removeButton.className = 'icon-button small-icon-button';
      removeButton.type = 'button';
      removeButton.setAttribute('aria-label', `Remove gradient stop ${index + 1}`);
      removeButton.title = 'Remove stop';
      removeButton.textContent = '\u00d7';
      removeButton.disabled = options.gradientStops.length <= 2;
      removeButton.addEventListener('click', () => {
        options.gradientStops.splice(index, 1);
        renderStops();
        onChange();
      });
      heading.append(label, removeButton);

      const controls = document.createElement('div');
      controls.className = 'gradient-stop-controls';
      const color = document.createElement('input');
      color.type = 'color';
      color.value = stop.color;
      color.setAttribute('aria-label', `Color for gradient stop ${index + 1}`);
      const hex = document.createElement('input');
      hex.type = 'text';
      hex.value = stop.color;
      hex.maxLength = 7;
      hex.spellcheck = false;
      hex.setAttribute('aria-label', `Hex color for gradient stop ${index + 1}`);
      const position = document.createElement('input');
      position.type = 'range';
      position.min = '0';
      position.max = '100';
      position.step = '1';
      position.value = Math.round(stop.position * 100);
      if (index > 0) position.min = Math.ceil(options.gradientStops[index - 1].position * 100);
      if (index < options.gradientStops.length - 1) position.max = Math.floor(options.gradientStops[index + 1].position * 100);
      position.setAttribute('aria-label', `Height position for gradient stop ${index + 1}`);
      const positionValue = document.createElement('output');
      positionValue.textContent = `${position.value}%`;

      color.addEventListener('input', () => {
        stop.color = color.value.toLowerCase();
        hex.value = stop.color;
        updatePreview();
        onChange();
      });
      hex.addEventListener('input', () => {
        const normalized = normalizeHex(hex.value);
        hex.setAttribute('aria-invalid', String(!normalized));
        if (!normalized) return;
        stop.color = normalized;
        color.value = normalized;
        updatePreview();
        onChange();
      });
      position.addEventListener('input', () => {
        stop.position = Number(position.value) / 100;
        positionValue.textContent = `${position.value}%`;
        updatePreview();
        onChange();
      });

      controls.append(color, hex, position, positionValue);
      row.append(heading, controls);
      editor.append(row);
    });
    countOutput.textContent = `${options.gradientStops.length} stops`;
    addButton.disabled = options.gradientStops.length >= maxGradientStops;
  };

  enabledInput.checked = options.gradientEnabled;
  enabledInput.addEventListener('change', update);
  addButton.addEventListener('click', () => {
    if (options.gradientStops.length >= maxGradientStops) return;
    const lastIndex = options.gradientStops.length - 1;
    const previousStop = options.gradientStops[lastIndex - 1];
    const lastStop = options.gradientStops[lastIndex];
    options.gradientStops.splice(lastIndex, 0, {
      position: (previousStop.position + lastStop.position) * 0.5,
      color: lastStop.color
    });
    renderStops();
    onChange();
  });
  renderStops();
}
