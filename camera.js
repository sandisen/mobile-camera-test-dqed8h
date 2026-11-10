'use strict';
const byId = (id) => document.getElementById(id);
const video = byId('video');
const canvas = byId('photo');
const placeholder = byId('placeholder');
const status = byId('status');
const openButton = byId('open');
const takeButton = byId('take');
const retryButton = byId('retry');
const closeButton = byId('close');
let stream = null;
let generation = 0;
let timeout = null;

const environment = /wxwork/i.test(navigator.userAgent) ? '企业微信内置浏览器' : '普通浏览器';
byId('context').textContent = environment + ' · ' + (window.isSecureContext ? '安全连接' : '非安全连接');

function show(state, message, error = false) {
  placeholder.hidden = state === 'live' || state === 'photo';
  video.hidden = state !== 'live';
  canvas.hidden = state !== 'photo';
  openButton.hidden = state !== 'idle';
  takeButton.hidden = state !== 'live';
  retryButton.hidden = state !== 'photo';
  closeButton.hidden = state === 'idle';
  closeButton.textContent = state === 'opening' ? '取消' : state === 'photo' ? '清除照片' : '关闭相机';
  status.textContent = message;
  status.dataset.error = String(error);
}

function stopTracks(value) {
  value?.getTracks().forEach((track) => track.stop());
}

function releaseCamera() {
  generation++;
  clearTimeout(timeout);
  timeout = null;
  stopTracks(stream);
  stream = null;
  video.srcObject = null;
}

function reset(message = '相机已关闭。', error = false) {
  releaseCamera();
  canvas.width = 0;
  canvas.height = 0;
  show('idle', message, error);
}

const reasons = {
  NotAllowedError: '相机权限未允许，或当前应用限制了网页访问相机',
  NotFoundError: '没有找到可用摄像头',
  NotReadableError: '摄像头无法启动，可能正被其他页面或应用使用',
  OverconstrainedError: '摄像头不支持当前取景设置',
  SecurityError: '当前环境不允许网页访问相机',
  AbortError: '摄像头启动中断',
};

async function openCamera() {
  reset();
  if (!window.isSecureContext) {
    reset('此页面不是安全连接，请使用 HTTPS 测试链接。', true);
    return;
  }
  if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
    reset('当前浏览器未开放网页相机接口（getUserMedia 不可用）。', true);
    return;
  }
  const attempt = generation;
  show('opening', '正在打开相机；若系统询问，请允许访问摄像头。');
  timeout = setTimeout(() => {
    if (attempt === generation) reset('相机启动超时。请确认相机权限后重试。', true);
  }, 25000);
  try {
    const opened = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    });
    if (attempt !== generation || document.hidden) {
      stopTracks(opened);
      return;
    }
    stream = opened;
    video.srcObject = stream;
    placeholder.hidden = true;
    video.hidden = false;
    await video.play();
    if (attempt !== generation) return;
    clearTimeout(timeout);
    timeout = null;
    const camera = stream.getVideoTracks()[0]?.getSettings?.().facingMode;
    const detail = camera === 'environment' ? '后置摄像头' : camera === 'user' ? '前置摄像头' : '摄像头';
    show('live', detail + '已打开，可以拍照。');
  } catch (error) {
    if (attempt !== generation) return;
    const name = typeof error?.name === 'string' ? error.name : 'UnknownError';
    reset((reasons[name] ?? '相机启动失败') + '（' + name + '）。', true);
  }
}

function takePhoto() {
  if (!stream || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    show('live', '取景画面还没准备好，请稍等再拍。', true);
    return;
  }
  try {
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    releaseCamera();
    show('photo', '拍照成功。照片仅在本页预览，相机已关闭。');
  } catch {
    reset('未能截取取景画面，请重新打开相机。', true);
  }
}

openButton.addEventListener('click', openCamera);
retryButton.addEventListener('click', openCamera);
takeButton.addEventListener('click', takePhoto);
closeButton.addEventListener('click', () => reset('相机已关闭，预览已清除。'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) reset('离开页面时已关闭相机。');
});
window.addEventListener('pagehide', () => reset());
