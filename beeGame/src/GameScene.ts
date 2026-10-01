import Phaser from 'phaser';

const CHUNK_WIDTH = 1600;
const CHUNK_HEIGHT = 1000;
const HIVE = { x: 800, y: 500, radius: 58 };
const CAPACITY = 100;
const BEE_SPEED = 245;
const FLOWER_COUNT = 24;
const FLOWER_MIN_DISTANCE = 88;
const FLOWER_EDGE_PADDING = 40;
const FLOWER_HIVE_CLEARANCE = 90;
const DANGER_ZONE_COUNT = 3;
const DANGER_ZONE_MIN_RADIUS = 85;
const DANGER_ZONE_MAX_RADIUS = 110;
const DANGER_ZONE_GAP = 70;
const MAX_PLACEMENT_ATTEMPTS = 1000;

type FlowerNode = {
  sprite: Phaser.GameObjects.Image;
  pollen: number;
  maxPollen: number;
  regrowAt: number;
};

type DangerZone = { x: number; y: number; radius: number };
type TerrainChunk = { x: number; y: number; graphics: Phaser.GameObjects.Graphics[] };

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing game UI element: ${id}`);
  return element as T;
};

export class GameScene extends Phaser.Scene {
  private bee!: Phaser.Physics.Arcade.Image;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private flowers: FlowerNode[] = [];
  private dangerZones: DangerZone[] = [];
  private terrainChunks = new Map<string, TerrainChunk>();
  private currentChunkX: number | null = null;
  private currentChunkY: number | null = null;
  private moveTarget: Phaser.Math.Vector2 | null = null;
  private pollen = 0;
  private health = 100;
  private stored = 0;
  private flowersVisited = 0;
  private returns = 0;
  private deaths = 0;
  private lastDamageAt = -Infinity;
  private respawnAt = 0;
  private noticeUntil = 0;
  private notice = '';
  private readonly healthFill = byId<HTMLSpanElement>('health-fill');
  private readonly pollenFill = byId<HTMLSpanElement>('pollen-fill');
  private readonly healthValue = byId<HTMLElement>('health-value');
  private readonly pollenValue = byId<HTMLElement>('pollen-value');
  private readonly storageValue = byId<HTMLElement>('hive-storage');
  private readonly flowerCount = byId<HTMLElement>('flowers-count');
  private readonly returnCount = byId<HTMLElement>('returns-count');
  private readonly tripCount = byId<HTMLElement>('trip-count');
  private readonly deathCount = byId<HTMLElement>('deaths-count');
  private readonly statusText = byId<HTMLElement>('game-status');
  private readonly statusIndicator = byId<HTMLElement>('status-indicator');
  private readonly runTime = byId<HTMLElement>('run-time');

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.pollen = 0;
    this.health = 100;
    this.stored = 0;
    this.flowersVisited = 0;
    this.returns = 0;
    this.deaths = 0;
    this.lastDamageAt = -Infinity;
    this.respawnAt = 0;
    this.noticeUntil = 0;
    this.notice = '';
    this.flowers = [];
    this.dangerZones = this.generateDangerZones();
    this.terrainChunks.clear();
    this.currentChunkX = null;
    this.currentChunkY = null;
    this.moveTarget = null;

    this.createTextures();
    this.drawDangerZones();
    this.add.image(HIVE.x, HIVE.y, 'hive').setDepth(2);
    this.add.text(HIVE.x, HIVE.y + 48, 'HOME', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#28473a',
      fontStyle: 'bold', backgroundColor: '#f2e7bd', padding: { x: 7, y: 4 },
    }).setOrigin(0.5).setDepth(3);

    this.generateFlowerPositions().forEach(([x, y], index) => {
      const pollen = 30 + ((index * 17) % 31);
      const sprite = this.add.image(x, y, `flower-${index % 4}`).setDepth(3);
      this.flowers.push({ sprite, pollen, maxPollen: pollen, regrowAt: 0 });
    });

    this.physics.world.setBounds(0, 0, CHUNK_WIDTH, CHUNK_HEIGHT);
    this.bee = this.physics.add.image(HIVE.x, HIVE.y - 2, 'bee').setDepth(5);
    this.bee.setCircle(13, 11, 9);
    this.bee.setCollideWorldBounds(true);
    this.updateTerrainChunks();
    this.cameras.main.startFollow(this.bee, true, 0.08, 0.08);

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keys = {
        up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        w: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        a: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        s: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        d: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.moveTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) this.moveTarget?.set(pointer.worldX, pointer.worldY);
    });

    this.updateHud();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    if (this.health <= 0) {
      this.bee.setVelocity(0, 0);
      if (this.time.now >= this.respawnAt) this.respawn();
      this.updateHud();
      return;
    }

    this.moveBee();
    this.updateTerrainChunks();
    this.updateFlowers(dt);
    this.updateDanger(dt);
    this.updateHive();
    this.updateHud();
  }

  private moveBee(): void {
    let x = Number(this.keys?.right.isDown || this.keys?.d.isDown)
      - Number(this.keys?.left.isDown || this.keys?.a.isDown);
    let y = Number(this.keys?.down.isDown || this.keys?.s.isDown)
      - Number(this.keys?.up.isDown || this.keys?.w.isDown);
    if (x !== 0 || y !== 0) {
      this.moveTarget = null;
    } else if (this.moveTarget) {
      x = this.moveTarget.x - this.bee.x;
      y = this.moveTarget.y - this.bee.y;
      if (Math.hypot(x, y) < 12) {
        this.moveTarget = null;
        x = 0;
        y = 0;
      }
    }

    const length = Math.hypot(x, y);
    if (length > 0) {
      x /= length;
      y /= length;
      this.bee.setVelocity(x * BEE_SPEED, y * BEE_SPEED);
      this.bee.setRotation(Math.atan2(y, x) + Math.PI / 2);
    } else {
      this.bee.setVelocity(0, 0);
    }
    const wingBeat = Math.sin(this.time.now / 44) * 0.035;
    this.bee.setScale(1 + wingBeat, 1 - wingBeat);
  }

  private updateFlowers(delta: number): void {
    for (const flower of this.flowers) {
      if (flower.pollen <= 0 && this.time.now >= flower.regrowAt) {
        flower.pollen = flower.maxPollen;
        flower.sprite.setAlpha(1).setScale(1);
      }
      if (flower.pollen <= 0) continue;

      const distance = Phaser.Math.Distance.Between(this.bee.x, this.bee.y, flower.sprite.x, flower.sprite.y);
      if (distance > 42 || this.pollen >= CAPACITY) continue;

      const gathered = Math.min((delta / 1000) * 13, flower.pollen, CAPACITY - this.pollen);
      flower.pollen -= gathered;
      this.pollen += gathered;
      flower.sprite.setScale(1 + Math.sin(this.time.now / 110) * 0.06);

      if (flower.pollen <= 0) {
        flower.pollen = 0;
        flower.regrowAt = this.time.now + 14000;
        flower.sprite.setAlpha(0.38).setScale(0.78);
        this.flowersVisited++;
      }
    }
  }

  private updateDanger(delta: number): void {
    const inDanger = this.dangerZones.some((zone) =>
      Phaser.Math.Distance.Between(this.bee.x, this.bee.y, zone.x, zone.y) < zone.radius,
    );

    if (inDanger) {
      this.health = Math.max(0, this.health - (5 * delta) / 1000);
      this.lastDamageAt = this.time.now;
      if (this.health <= 0) {
        this.deaths++;
        this.pollen = 0;
        this.respawnAt = this.time.now + 1800;
        this.showNotice('Exhausted. Returning to the hive…', 1800);
      }
    } else if (this.time.now - this.lastDamageAt > 2200) {
      this.health = Math.min(100, this.health + (delta / 1000));
    }
  }

  private updateHive(): void {
    const atHive = Phaser.Math.Distance.Between(this.bee.x, this.bee.y, HIVE.x, HIVE.y) < HIVE.radius;
    if (atHive && this.pollen > 0) {
      const amount = Math.round(this.pollen);
      this.stored += amount;
      this.pollen = 0;
      this.returns++;
      this.showNotice(`Harvest banked: ${amount} grains`, 2400);
    }
  }

  private respawn(): void {
    this.health = 100;
    this.pollen = 0;
    this.lastDamageAt = -Infinity;
    this.bee.setPosition(HIVE.x, HIVE.y - 2).setAlpha(1).setVelocity(0, 0);
    this.showNotice('Back at the hive. Your carried pollen was lost.', 2800);
  }

  private showNotice(message: string, duration: number): void {
    this.notice = message;
    this.noticeUntil = this.time.now + duration;
  }

  private updateHud(): void {
    const healthPercent = Math.round(this.health);
    const pollenPercent = Math.round((this.pollen / CAPACITY) * 100);
    this.healthFill.style.width = `${healthPercent}%`;
    this.pollenFill.style.width = `${pollenPercent}%`;
    this.healthValue.textContent = `${healthPercent}%`;
    this.pollenValue.textContent = `${Math.floor(this.pollen)} / ${CAPACITY}`;
    this.storageValue.textContent = Math.floor(this.stored).toLocaleString();
    this.flowerCount.textContent = String(this.flowersVisited);
    this.returnCount.textContent = String(this.returns);
    this.tripCount.textContent = String(this.returns);
    this.deathCount.textContent = String(this.deaths);

    const seconds = Math.floor(this.time.now / 1000);
    this.runTime.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

    const inDanger = this.dangerZones.some((zone) =>
      Phaser.Math.Distance.Between(this.bee.x, this.bee.y, zone.x, zone.y) < zone.radius,
    );
    const status = this.time.now < this.noticeUntil
      ? this.notice
      : this.health <= 0
        ? 'Returning to the hive…'
        : this.pollen >= CAPACITY
          ? 'Pollen sack full. Return to the hive.'
          : inDanger
            ? 'Contaminated ground. Find a clear path.'
            : this.pollen > 0
              ? 'Harvest in progress'
              : 'Explore the meadow';
    this.statusText.textContent = status;
    this.statusIndicator.classList.toggle('status-danger', inDanger || this.health < 35);
    this.statusIndicator.classList.toggle('status-full', this.pollen >= CAPACITY);
  }

  private generateDangerZones(): DangerZone[] {
    const zones: DangerZone[] = [];
    for (let index = 0; index < DANGER_ZONE_COUNT; index++) {
      let placed = false;
      for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS && !placed; attempt++) {
        const radius = Phaser.Math.Between(DANGER_ZONE_MIN_RADIUS, DANGER_ZONE_MAX_RADIUS);
        const zone = {
          x: Phaser.Math.Between(radius + 20, CHUNK_WIDTH - radius - 20),
          y: Phaser.Math.Between(radius + 20, CHUNK_HEIGHT - radius - 20),
          radius,
        };
        const clearOfHive = Phaser.Math.Distance.Between(zone.x, zone.y, HIVE.x, HIVE.y)
          >= zone.radius + HIVE.radius + 80;
        const clearOfZones = zones.every((other) =>
          Phaser.Math.Distance.Between(zone.x, zone.y, other.x, other.y)
            >= zone.radius + other.radius + DANGER_ZONE_GAP,
        );
        if (clearOfHive && clearOfZones) {
          zones.push(zone);
          placed = true;
        }
      }
      if (!placed) throw new Error('Unable to place all danger zones.');
    }
    return zones;
  }

  private generateFlowerPositions(): number[][] {
    const positions: number[][] = [];
    for (let index = 0; index < FLOWER_COUNT; index++) {
      let placed = false;
      for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS && !placed; attempt++) {
        const x = Phaser.Math.Between(FLOWER_EDGE_PADDING, CHUNK_WIDTH - FLOWER_EDGE_PADDING);
        const y = Phaser.Math.Between(FLOWER_EDGE_PADDING, CHUNK_HEIGHT - FLOWER_EDGE_PADDING);
        const clearOfHive = Phaser.Math.Distance.Between(x, y, HIVE.x, HIVE.y)
          >= HIVE.radius + FLOWER_HIVE_CLEARANCE;
        const clearOfFlowers = positions.every(([otherX, otherY]) =>
          Phaser.Math.Distance.Between(x, y, otherX, otherY) >= FLOWER_MIN_DISTANCE,
        );
        const clearOfDanger = this.dangerZones.every((zone) =>
          Phaser.Math.Distance.Between(x, y, zone.x, zone.y) >= zone.radius + 45,
        );
        if (clearOfHive && clearOfFlowers && clearOfDanger) {
          positions.push([x, y]);
          placed = true;
        }
      }
      if (!placed) throw new Error('Unable to place all flowers.');
    }
    return positions;
  }

  private updateTerrainChunks(): void {
    const chunkX = Math.floor(this.bee.x / CHUNK_WIDTH);
    const chunkY = Math.floor(this.bee.y / CHUNK_HEIGHT);
    if (chunkX === this.currentChunkX && chunkY === this.currentChunkY) return;

    this.currentChunkX = chunkX;
    this.currentChunkY = chunkY;
    for (let y = chunkY - 1; y <= chunkY + 1; y++) {
      for (let x = chunkX - 1; x <= chunkX + 1; x++) {
        const key = `${x},${y}`;
        if (!this.terrainChunks.has(key)) {
          this.terrainChunks.set(key, { x, y, graphics: this.drawMeadow(x, y) });
        }
      }
    }

    for (const [key, chunk] of this.terrainChunks) {
      if (Math.abs(chunk.x - chunkX) > 1 || Math.abs(chunk.y - chunkY) > 1) {
        chunk.graphics.forEach((layer) => layer.destroy());
        this.terrainChunks.delete(key);
      }
    }

    const boundsX = (chunkX - 1) * CHUNK_WIDTH;
    const boundsY = (chunkY - 1) * CHUNK_HEIGHT;
    this.physics.world.setBounds(boundsX, boundsY, CHUNK_WIDTH * 3, CHUNK_HEIGHT * 3);
    this.cameras.main.setBounds(boundsX, boundsY, CHUNK_WIDTH * 3, CHUNK_HEIGHT * 3);
  }

  private drawMeadow(chunkX: number, chunkY: number): Phaser.GameObjects.Graphics[] {
    const originX = chunkX * CHUNK_WIDTH;
    const originY = chunkY * CHUNK_HEIGHT;
    const ground = this.add.graphics().setDepth(0);
    ground.fillStyle(0x82976a).fillRect(originX, originY, CHUNK_WIDTH, CHUNK_HEIGHT);
    ground.fillStyle(0x718c60, 0.42);
    for (let index = 0; index < 125; index++) {
      const x = originX + Phaser.Math.Between(80, CHUNK_WIDTH - 80);
      const y = originY + Phaser.Math.Between(80, CHUNK_HEIGHT - 80);
      ground.fillEllipse(x, y, 90 + (index % 4) * 17, 35 + (index % 3) * 12);
    }
    ground.lineStyle(46, 0xd4c590, 0.34);
    ground.beginPath();
    ground.moveTo(originX, originY + CHUNK_HEIGHT / 2);
    ground.lineTo(originX + CHUNK_WIDTH, originY + CHUNK_HEIGHT / 2);
    ground.strokePath();

    const speckles = this.add.graphics().setDepth(1);
    for (let index = 0; index < 280; index++) {
      const x = originX + Phaser.Math.Between(0, CHUNK_WIDTH);
      const y = originY + Phaser.Math.Between(0, CHUNK_HEIGHT);
      speckles.fillStyle(index % 3 === 0 ? 0xf2e9bd : 0x405f46, index % 3 === 0 ? 0.35 : 0.22);
      speckles.fillCircle(x, y, index % 5 === 0 ? 2.4 : 1.4);
    }
    return [ground, speckles];
  }

  private drawDangerZones(): void {
    const graphics = this.add.graphics().setDepth(1);
    for (const zone of this.dangerZones) {
      graphics.fillStyle(0xc87756, 0.32).fillCircle(zone.x, zone.y, zone.radius);
      graphics.lineStyle(3, 0xb8664d, 0.68).strokeCircle(zone.x, zone.y, zone.radius);
      graphics.lineStyle(1, 0xf4c18d, 0.56);
      for (let offset = -zone.radius; offset < zone.radius; offset += 18) {
        const halfChord = Math.sqrt(Math.max(0, zone.radius ** 2 - offset ** 2));
        graphics.beginPath();
        graphics.moveTo(zone.x + offset - halfChord, zone.y - halfChord);
        graphics.lineTo(zone.x + offset + halfChord, zone.y + halfChord);
        graphics.strokePath();
      }
      graphics.fillStyle(0x8e4d3e, 0.8).fillCircle(zone.x, zone.y, 5);
    }
  }

  private createTextures(): void {
    const bee = this.make.graphics({ x: 0, y: 0 }, false);
    bee.fillStyle(0xf3e4bd).fillEllipse(13, 10, 16, 27);
    bee.fillStyle(0xc9d8c7, 0.9).fillEllipse(5, 8, 10, 17);
    bee.fillStyle(0xc9d8c7, 0.9).fillEllipse(21, 8, 10, 17);
    bee.fillStyle(0x343b30).fillEllipse(13, 19, 14, 15);
    bee.fillStyle(0xf0b744).fillEllipse(13, 11, 15, 19);
    bee.fillStyle(0x343b30).fillRect(6, 9, 14, 3);
    bee.fillStyle(0x343b30).fillRect(7, 16, 12, 3);
    bee.fillStyle(0x292d27).fillCircle(13, 3, 5);
    bee.fillStyle(0x292d27).fillCircle(11, 2, 1);
    bee.fillStyle(0x292d27).fillCircle(15, 2, 1);
    bee.generateTexture('bee', 26, 32);
    bee.destroy();

    const hive = this.make.graphics({ x: 0, y: 0 }, false);
    hive.fillStyle(0x304b3a, 0.2).fillEllipse(35, 45, 62, 18);
    hive.fillStyle(0xd6a94f).fillCircle(35, 31, 28);
    hive.fillStyle(0xf1d58d).fillCircle(35, 27, 23);
    hive.lineStyle(3, 0x9b7038, 0.8).strokeCircle(35, 31, 25);
    hive.lineStyle(2, 0xb48842, 0.7).strokeCircle(35, 31, 16);
    hive.fillStyle(0x604733).fillEllipse(35, 39, 13, 17);
    hive.fillStyle(0x344b3a).fillEllipse(35, 36, 7, 10);
    hive.generateTexture('hive', 70, 54);
    hive.destroy();

    const petalColors = [0xedddaa, 0xe68d79, 0xc6d1a2, 0xd5b5ce];
    const centers = [0xd49b3f, 0xe5bf5b, 0x967b4d, 0xefcb69];
    petalColors.forEach((color, index) => {
      const flower = this.make.graphics({ x: 0, y: 0 }, false);
      flower.fillStyle(0x3e6547).fillEllipse(22, 39, 24, 9);
      flower.fillStyle(0x57794f).fillEllipse(15, 35, 14, 7).fillEllipse(28, 33, 13, 7);
      for (let petal = 0; petal < 6; petal++) {
        const angle = (petal / 6) * Math.PI * 2;
        flower.fillStyle(color).fillEllipse(22 + Math.cos(angle) * 10, 20 + Math.sin(angle) * 10, 11, 8);
      }
      flower.fillStyle(centers[index]).fillCircle(22, 20, 6);
      flower.fillStyle(0xf8edc7, 0.72).fillCircle(20, 18, 1.7);
      flower.generateTexture(`flower-${index}`, 44, 44);
      flower.destroy();
    });
  }
}