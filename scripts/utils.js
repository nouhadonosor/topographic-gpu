function hexToRgba(hex) {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).concat(1);
}

function normalizeHex(value) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

function isCompleteNumber(value) {
  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(value.trim()) && Number.isFinite(Number(value));
}

function isStepAligned(value, minimum, step) {
  const steps = (value - minimum) / step;
  return Math.abs(steps - Math.round(steps)) < 1e-7;
}

function download(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
