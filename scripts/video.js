function recordCanvasVideo({ canvas, duration, bitrate, onProgress, onStart, onStop, onError, onBeforeStop }) {
  if (!window.MediaRecorder || !canvas.captureStream) {
    onError('Video recording is unavailable in this browser.');
    return null;
  }
  const mimeType = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ]
    .find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) {
    onError('This browser cannot encode MP4 or WebM video.');
    return null;
  }

  const durationMilliseconds = Math.min(30, Math.max(1, duration)) * 1000;
  const stream = canvas.captureStream(60);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: bitrate * 1000000
  });
  const chunks = [];
  recorder.addEventListener('dataavailable', event => {
    if (event.data.size) chunks.push(event.data);
  });
  recorder.addEventListener('stop', () => {
    const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    download(new Blob(chunks, { type: mimeType }), `topographic-preview.${extension}`);
    stream.getTracks().forEach(track => track.stop());
    onStop();
  });

  onStart();
  recorder.start();
  const startedAt = performance.now();
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
