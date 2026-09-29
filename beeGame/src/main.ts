import Phaser from 'phaser';
import { GameScene } from './GameScene';
import './style.css';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 800,
  backgroundColor: '#82976a',
  render: {
    antialias: true,
    pixelArt: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [GameScene],
});

const pauseButton = document.querySelector<HTMLButtonElement>('#pause-button')!;
const restartButton = document.querySelector<HTMLButtonElement>('#restart-button')!;

pauseButton.addEventListener('click', () => {
  const paused = game.scene.isPaused('GameScene');
  if (paused) {
    game.scene.resume('GameScene');
  } else {
    game.scene.pause('GameScene');
  }
  pauseButton.textContent = paused ? 'Pause' : 'Resume';
  pauseButton.setAttribute('aria-pressed', String(!paused));
});

restartButton.addEventListener('click', () => {
  game.scene.stop('GameScene');
  game.scene.start('GameScene');
  pauseButton.textContent = 'Pause';
  pauseButton.setAttribute('aria-pressed', 'false');
});

window.addEventListener('beforeunload', () => game.destroy(true));