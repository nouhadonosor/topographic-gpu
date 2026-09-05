function saveCanvasImage(canvas) {
  canvas.toBlob(blob => download(blob, 'topographic-preview.png'), 'image/png');
}
