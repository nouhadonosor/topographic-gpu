function recordCanvasVideo({ canvas, duration, bitrate, onProgress, onStart, onStop, onError, onBeforeStop }) {
  if (!window.MediaRecorder || !canvas.captureStream) {
    onError('WebM recording is unavailable in this browser.');
    return null;
  }
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) {
    onError('This browser cannot record WebM video.');
    return null;
  }

  const durationMilliseconds = Math.min(30, Math.max(1, duration)) * 1000;
  const stream = canvas.captureStream(60);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: bitrate * 1000000
  });
  const chunks = [];
  const startedAt = performance.now();
  recorder.addEventListener('dataavailable', event => {
    if (event.data.size) chunks.push(event.data);
  });
  recorder.addEventListener('stop', () => {
    download(new Blob(chunks, { type: mimeType }), 'topographic-preview.webm');
    stream.getTracks().forEach(track => track.stop());
    onStop();
  });

  recorder.start();
  onStart();
  const updateProgress = now => {
    const progress = Math.min(100, Math.round(((now - startedAt) / durationMilliseconds) * 100));
    onProgress(progress);
    if (recorder.state === 'recording' && progress < 100) requestAnimationFrame(updateProgress);
  };
  requestAnimationFrame(updateProgress);
  setTimeout(() => {
    if (onBeforeStop) onBeforeStop();
    recorder.stop();
  }, durationMilliseconds);
  return recorder;
}
