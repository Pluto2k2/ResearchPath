import { ramyMessages } from './ramy.js';

// Real pixel sizes of the PNG files: width and height attributes avoid layout jumps.
export const POSES = {
  thinking: [158, 230],
  wave: [170, 211],
  celebrate: [171, 225],
  idle: [146, 244],
  sleep: [161, 222],
  tablet: [128, 221],
  reading: [147, 209],
  shy: [126, 216],
};

const CELEBRATE_MS = 2000;

export const poseSrc = (pose) => `mascot/mascot-${pose}.png`;

// The only code that changes a Ramy image or bubble.
export function setMascot(pose, text, root = document.getElementById('ramy')) {
  if (!root) return;
  const name = Object.hasOwn(POSES, pose) ? pose : 'idle';
  const [width, height] = POSES[name];
  const img = root.querySelector('.ramy-img');
  if (img) {
    img.src = poseSrc(name);
    img.width = width;
    img.height = height;
  }
  const bubble = root.querySelector('.ramy-bubble');
  if (bubble && bubble.textContent !== text) bubble.textContent = text;
}

export function createRamyImage(pose) {
  const name = Object.hasOwn(POSES, pose) ? pose : 'idle';
  const [width, height] = POSES[name];
  const img = document.createElement('img');
  img.className = 'ramy-img ramy-small';
  img.alt = '';
  img.loading = 'lazy';
  img.width = width;
  img.height = height;
  img.src = poseSrc(name);
  return img;
}

export function initHeroRamy() {
  let messages = ramyMessages();
  let index = 0;
  let timer = null;

  const show = () => setMascot(messages[index].pose, messages[index].text);

  function update(input) {
    messages = ramyMessages(input);
    index = 0;
    clearTimeout(timer);
    show();
  }

  function celebrate() {
    clearTimeout(timer);
    setMascot('celebrate', 'Well done, one more milestone finished!');
    timer = setTimeout(show, CELEBRATE_MS);
  }

  document.getElementById('ramy-button')?.addEventListener('click', () => {
    clearTimeout(timer);
    index = (index + 1) % messages.length;
    show();
  });

  show();
  return { update, celebrate };
}
