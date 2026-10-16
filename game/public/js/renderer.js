const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class BattleRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.width = 960;
    this.height = 540;
    this.pixelRatio = 1;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.spriteImages = new Map();
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * this.pixelRatio);
    this.canvas.height = Math.round(rect.height * this.pixelRatio);
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  }

  render(engine) {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;

    // Apply screen shake
    if (this.shake > 0) {
      this.shakeX = (Math.random() - 0.5) * this.shake * 2;
      this.shakeY = (Math.random() - 0.5) * this.shake * 2;
      this.shake = Math.max(0, this.shake - 0.65);
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    this._drawArenaMarkings(ctx, width, height);

    const inStasis = engine.fighters.some((fighter) => fighter.ultimateState?.kind === 'world_stasis');
    if (inStasis) {
      this._drawStasisAtmosphere(ctx, width, height);
    }

    for (const effect of engine.effects) {
      this._checkEffectShake(effect);
      this._drawEffect(ctx, effect, width, height);
    }
    for (const projectile of engine.projectiles) {
      this._drawProjectile(ctx, projectile);
    }
    for (const fighter of engine.fighters) {
      if (!fighter.alive && engine.result?.loserSide === fighter.side) continue;
      this._drawFighter(ctx, fighter, engine.elapsed, inStasis);
    }

    ctx.restore();
  }

  _getSpriteImage(character) {
    if (!character.spriteImage || typeof Image === 'undefined') return null;
    let image = this.spriteImages.get(character.spriteImage);
    if (!image) {
      image = new Image();
      image.decoding = 'async';
      image.src = character.spriteImage;
      this.spriteImages.set(character.spriteImage, image);
    }
    return image.complete && image.naturalWidth > 0 ? image : null;
  }

  _checkEffectShake(effect) {
    const progress = effect.life / effect.maxLife;
    if (progress > 0.9) {
      if (effect.type === 'slash-wave') {
        this.shake = Math.max(this.shake, effect.isFinal ? 14 : 5.5);
      } else if (effect.type === 'stasis-shatter') {
        this.shake = Math.max(this.shake, 16);
      } else if (effect.type === 'stasis-shockwave') {
        this.shake = Math.max(this.shake, 7);
      } else if (effect.type === 'melee-slash') {
        this.shake = Math.max(this.shake, 4);
      } else if (effect.type === 'thunderbolt') {
        this.shake = Math.max(this.shake, 8);
      } else if (effect.type === 'lightning-strike') {
        this.shake = Math.max(this.shake, 3);
      }
    }
  }

  _drawStasisAtmosphere(ctx, width, height) {
    // High-contrast dimensional monochrome void
    ctx.fillStyle = 'rgba(12, 16, 24, 0.76)';
    ctx.fillRect(0, 0, width, height);

    // Spatial scanlines
    ctx.fillStyle = 'rgba(103, 232, 249, 0.08)';
    for (let y = 0; y < height; y += 7) ctx.fillRect(0, y, width, 1.5);

    // Cross grid lines
    ctx.fillStyle = 'rgba(165, 243, 252, 0.035)';
    for (let x = 0; x < width; x += 18) ctx.fillRect(x, 0, 1.5, height);

    // Suspended temporal crystals
    ctx.fillStyle = '#bae6fd';
    for (let i = 0; i < 28; i += 1) {
      const px = ((i * 139.7) % (width - 40)) + 20;
      const py = ((i * 87.3) % (height - 40)) + 20;
      ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
    }

    // Glowing dimensional arena edge
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 15;
    ctx.strokeRect(18, 18, width - 36, height - 36);
    ctx.restore();
  }

  _drawArenaMarkings(ctx, width, height) {
    const margin = Math.max(18, Math.min(width, height) * 0.045);
    ctx.save();
    // Subtle 4×4 grid inside the arena box: three inner lines per axis.
    const innerWidth = width - margin * 2;
    const innerHeight = height - margin * 2;
    ctx.strokeStyle = 'rgba(28, 39, 45, .075)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    for (let column = 1; column < 4; column += 1) {
      const x = margin + innerWidth * column / 4;
      ctx.moveTo(x, margin);
      ctx.lineTo(x, height - margin);
    }
    for (let row = 1; row < 4; row += 1) {
      const y = margin + innerHeight * row / 4;
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(28, 39, 45, .09)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.moveTo(width / 2, margin);
    ctx.lineTo(width / 2, height - margin);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.12, 0, Math.PI * 2);
    ctx.stroke();
    const size = 10;
    ctx.fillStyle = 'rgba(20,24,29,.25)';
    for (const [x, y, sx, sy] of [[margin, margin, 1, 1], [width - margin, margin, -1, 1], [margin, height - margin, 1, -1], [width - margin, height - margin, -1, -1]]) {
      ctx.fillRect(x, y, size * sx, 2);
      ctx.fillRect(x, y, 2, size * sy);
    }
    ctx.restore();
  }

  _drawFighter(ctx, fighter, elapsed, inStasis = false) {
    const char = fighter.character;
    const sprite = char.sprite ?? {};
    const isHit = fighter.flash > 0;
    const main = isHit ? '#ff3b45' : sprite.main ?? (fighter.side === 'left' ? '#167ec2' : '#d66b2a');
    const accent = isHit ? '#ffc1c4' : sprite.accent ?? '#28d7ff';
    const skin = isHit ? '#ff969a' : sprite.skin ?? '#f2c59d';
    const shadow = isHit ? '#801b27' : sprite.shadow ?? '#243039';
    const scale = Math.max(0.82, Math.min(1.38, this.width / 700));
    const step = Math.floor(elapsed * 8 + (fighter.side === 'right' ? 1 : 0)) % 2;
    const facing = fighter.facing || (fighter.side === 'left' ? 1 : -1);
    const customImage = this._getSpriteImage(char);

    // Slashing dynamics
    const slashAnim = fighter.slashAnim || 0;
    const isSlashing = slashAnim > 0;
    const slashProgress = isSlashing ? Math.max(0, Math.min(1, 1 - (slashAnim / (fighter.slashDuration || 0.28)))) : 0;

    const lunge = isSlashing ? Math.sin(slashProgress * Math.PI) * 11 * facing : 0;
    const dip = isSlashing ? Math.sin(slashProgress * Math.PI) * 4 : 0;
    const lean = isSlashing ? facing * Math.sin(slashProgress * Math.PI) * 0.14 : 0;

    // Temporal chromatic aberration ghosting when locked in Stasis
    if (inStasis) {
      this._drawGhostSilhouette(ctx, fighter, scale, step, facing, -4, 0, 'rgba(56, 189, 248, 0.45)');
      this._drawGhostSilhouette(ctx, fighter, scale, step, facing, 4, 0, 'rgba(244, 63, 94, 0.4)');
    }

    ctx.save();
    ctx.translate(Math.round(fighter.x + lunge), Math.round(fighter.y + dip));
    ctx.rotate(lean);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(20,24,29,.15)';
    ctx.fillRect(-17, 18, 34, 5);

    if (customImage) {
      ctx.save();
      ctx.scale(facing, 1);
      ctx.imageSmoothingEnabled = false;
      const bob = Math.sin(elapsed * 7 + (fighter.side === 'right' ? 1 : 0)) * 1.3;
      ctx.globalAlpha = isHit ? 0.72 : 1;
      ctx.drawImage(customImage, -34, -36 + bob, 68, 72);
      ctx.restore();
    } else {
      // Pixel-art fallback for fighters without a supplied sprite image.
      this._pixel(ctx, -11, -13 + step, 22, 23, main);
      this._pixel(ctx, -10, -17 + step, 20, 4, shadow);
      this._pixel(ctx, -8, -31 + step, 16, 15, skin);
      this._pixel(ctx, -11, -34 + step, 22, 6, shadow);
      this._pixel(ctx, -8, -28 + step, 16, 3, char.weapon === 'cung' ? '#543628' : '#d7e7ec');
      this._pixel(ctx, -7 + facing * 4, -25 + step, 3, 3, '#16242c');
      this._pixel(ctx, -11, -9 + step, 5, 8, shadow);
      this._pixel(ctx, 6, -9 + step, 5, 8, shadow);
      this._pixel(ctx, -10 - step * 2, 9, 7, 12, shadow);
      this._pixel(ctx, 3 + step * 2, 9, 7, 12, shadow);
      this._pixel(ctx, -10 - step * 2, 18, 9, 4, '#14181d');
      this._pixel(ctx, 2 + step * 2, 18, 9, 4, '#14181d');
      this._pixel(ctx, -15, -9 + step, 5, 13, accent);
      this._pixel(ctx, 10, -9 + step, 5, 13, accent);
      if (char.id === 'nep') {
        this._pixel(ctx, -17, -9 + step, 8, 24, shadow);
        this._pixel(ctx, -15, -8 + step, 5, 20, main);
        this._pixel(ctx, -15, -36 + step, 30, 5, '#c7aa70');
        this._pixel(ctx, -18, -31 + step, 7, 22, '#c7aa70');
        this._pixel(ctx, -16, -29 + step, 3, 17, '#f0d995');
        this._pixel(ctx, -5, -38 + step, 10, 2, accent);
      } else if (char.id === 'chuong_reu') {
        this._pixel(ctx, -15, -24 + step, 30, 22, shadow);
        this._pixel(ctx, -13, -28 + step, 26, 5, accent);
        this._pixel(ctx, -11, -23 + step, 22, 17, main);
        this._pixel(ctx, -8, -32 + step, 16, 5, '#b8d58c');
        this._pixel(ctx, -4, -36 + step, 8, 4, '#e3e8bd');
        this._pixel(ctx, -4, -16 + step, 8, 3, '#d7c794');
        this._pixel(ctx, -9, -25 + step, 3, 3, '#f2f1d4');
        this._pixel(ctx, 5, -25 + step, 3, 3, '#f2f1d4');
      }
      if (char.weapon === 'trượng sét') {
        this._pixel(ctx, -13, -40 + step, 26, 5, shadow);
        this._pixel(ctx, -10, -44 + step, 20, 4, accent);
        this._pixel(ctx, -7, -48 + step, 14, 4, main);
        this._pixel(ctx, -4, -52 + step, 8, 4, accent);
        this._pixel(ctx, -2, -55 + step, 4, 3, '#ffffff');
      }
      this._drawWeapon(ctx, char.weapon, facing, accent, shadow, step, isSlashing, slashProgress);
    }

    if (fighter.stunTimer > 0) {
      const orbit = elapsed * 7;
      ctx.fillStyle = '#ffe15b';
      for (let i = 0; i < 3; i += 1) {
        const angle = orbit + i * (Math.PI * 2 / 3);
        const x = Math.cos(angle) * 20;
        const y = -43 + Math.sin(angle) * 4;
        ctx.fillRect(Math.round(x - 2), Math.round(y - 2), 5, 5);
        ctx.fillRect(Math.round(x - 4), Math.round(y), 9, 2);
      }
    }
    if (fighter.noteStatus?.timer > 0) {
      const label = fighter.noteStatus.glyph === 'leaf' ? 'MẦM' : fighter.noteStatus.glyph === 'dew' ? 'SƯƠNG' : 'GIÓ';
      const tint = fighter.noteStatus.glyph === 'leaf' ? '#69a95c' : fighter.noteStatus.glyph === 'dew' ? '#61aebd' : '#b09f4f';
      ctx.fillStyle = tint;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.font = 'bold 8px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText(label, 0, -40);
      ctx.fillText(label, 0, -40);
    }

    // The circular HP counter floats over the fighter.
    const hpY = -55 + step;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#14181d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, hpY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = fighter.hp / fighter.maxHp <= 0.25 ? '#e84f49' : '#14181d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
    ctx.fillText(String(Math.max(0, Math.ceil(fighter.hp))), 0, hpY + 1);
    ctx.restore();
  }

  _drawGhostSilhouette(ctx, fighter, scale, step, facing, offsetX, offsetY, color) {
    ctx.save();
    ctx.translate(Math.round(fighter.x + offsetX), Math.round(fighter.y + offsetY));
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.fillRect(-11, -13 + step, 22, 23);
    ctx.fillRect(-8, -31 + step, 16, 15);
    ctx.fillRect(-15, -9 + step, 5, 13);
    ctx.fillRect(10, -9 + step, 5, 13);
    ctx.restore();
  }

  _pixel(ctx, x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  _drawWeapon(ctx, weapon, facing, accent, shadow, step, isSlashing = false, slashProgress = 0) {
    ctx.save();
    ctx.translate(facing * 12, -3 + step);
    ctx.scale(facing, 1);

    if (weapon === 'cung') {
      ctx.strokeStyle = shadow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 14, -1.15, 1.15);
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(5, -12);
      ctx.lineTo(5, 12);
      ctx.stroke();
    } else if (weapon === 'trượng sét') {
      ctx.fillStyle = shadow;
      ctx.fillRect(8, -20, 4, 36);
      ctx.fillStyle = '#d8f5ff';
      ctx.shadowColor = accent;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(10, -23, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(10, -29);
      ctx.lineTo(7, -22);
      ctx.lineTo(11, -22);
      ctx.lineTo(8, -16);
      ctx.lineTo(14, -24);
      ctx.lineTo(10, -24);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (weapon === 'bản đồ gấp') {
      ctx.fillStyle = '#c7aa70';
      ctx.strokeStyle = shadow;
      ctx.lineWidth = 2;
      ctx.fillRect(8, -14, 10, 28);
      ctx.strokeRect(8, -14, 10, 28);
      ctx.fillStyle = '#f0d995';
      ctx.fillRect(10, -10, 6, 20);
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.moveTo(11, -6);
      ctx.lineTo(15, -2);
      ctx.lineTo(11, 2);
      ctx.lineTo(15, 6);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(3, -20, 7, 7);
    } else if (weapon === 'chuông terrarium') {
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.moveTo(5, -16);
      ctx.quadraticCurveTo(7, -26, 17, -26);
      ctx.quadraticCurveTo(27, -26, 29, -16);
      ctx.lineTo(27, 2);
      ctx.lineTo(7, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.fillRect(8, -14, 18, 4);
      ctx.fillStyle = '#dbeab1';
      ctx.fillRect(12, -22, 3, 7);
      ctx.fillRect(19, -20, 3, 5);
      ctx.fillStyle = shadow;
      ctx.fillRect(14, 1, 6, 5);
    } else {
      // Dynamic sword slash swing animation
      let swingAngle = 0;
      if (isSlashing) {
        if (slashProgress < 0.22) {
          // Wind-up: pull sword back and up
          const t = slashProgress / 0.22;
          swingAngle = -1.15 * t;
        } else if (slashProgress < 0.65) {
          // Strike: violent downward-forward slash arc
          const t = (slashProgress - 0.22) / 0.43;
          swingAngle = -1.15 + t * 2.25; // From -1.15 to +1.1 rad (~63 deg)

          // Blade smear trails (afterimages)
          ctx.save();
          ctx.rotate(swingAngle - 0.4);
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = 'rgba(40, 215, 255, 0.7)';
          ctx.beginPath();
          ctx.moveTo(4, -4);
          ctx.lineTo(32, -9);
          ctx.lineTo(26, 1);
          ctx.lineTo(4, 3);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          ctx.save();
          ctx.rotate(swingAngle - 0.75);
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.beginPath();
          ctx.moveTo(4, -4);
          ctx.lineTo(30, -8);
          ctx.lineTo(25, 1);
          ctx.lineTo(4, 3);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          // Recovery: bring sword back to ready pose
          const t = (slashProgress - 0.65) / 0.35;
          swingAngle = 1.1 * (1 - t);
        }
      }

      ctx.rotate(swingAngle);

      // Sword blade
      ctx.fillStyle = isSlashing ? '#ffffff' : '#f7fbff';
      ctx.strokeStyle = isSlashing ? '#00e5ff' : shadow;
      ctx.lineWidth = isSlashing ? 2.5 : 2;
      if (isSlashing) {
        ctx.shadowColor = '#28d7ff';
        ctx.shadowBlur = 12;
      }
      ctx.beginPath();
      ctx.moveTo(4, -3);
      ctx.lineTo(31, -7);
      ctx.lineTo(26, -1);
      ctx.lineTo(4, 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Hilt and guard
      ctx.fillStyle = accent;
      ctx.fillRect(3, -5, 6, 7);
      ctx.fillStyle = '#104d77';
      ctx.fillRect(0, -2, 4, 3);
    }
    ctx.restore();
  }

  _drawProjectile(ctx, projectile) {
    const angle = Math.atan2(projectile.vy, projectile.vx);
    const alpha = projectile.frozen ? 0.84 : 1;
    ctx.save();
    for (let i = projectile.trail.length - 1; i >= 0; i -= 1) {
      const point = projectile.trail[i];
      const opacity = (1 - i / projectile.trail.length) * 0.25;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = projectile.color;
      ctx.fillRect(point.x - 5, point.y - 2, 10, 4);
    }
    ctx.globalAlpha = alpha;
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(angle);
    if (projectile.kind === 'arrow' || projectile.kind === 'rain_arrow') {
      ctx.fillStyle = '#5c371e';
      ctx.fillRect(-12, -1.5, 21, 3);
      ctx.fillStyle = projectile.color;
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(5, -5);
      ctx.lineTo(7, 0);
      ctx.lineTo(5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-13, -4, 4, 2);
      ctx.fillRect(-13, 2, 4, 2);
    } else if (projectile.kind === 'anchor_pin') {
      ctx.shadowColor = projectile.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#f4df9b';
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(1, -5);
      ctx.lineTo(-8, -3);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-8, 3);
      ctx.lineTo(1, 5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = projectile.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (projectile.kind === 'bell_wave') {
      ctx.shadowColor = projectile.color;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = projectile.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 7, -1.25, 1.25);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-2, 0, 11, -1.1, 1.1);
      ctx.stroke();
      ctx.fillStyle = '#f5f0d4';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (projectile.kind === 'energy_blade') {
      ctx.shadowColor = projectile.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#e8fbff';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-5, -5);
      ctx.lineTo(-12, 0);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = projectile.color;
      ctx.fillRect(-4, -2, 16, 4);
    } else {
      ctx.shadowColor = projectile.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = projectile.color;
      ctx.beginPath();
      ctx.arc(0, 0, projectile.radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -2, 4, 4);
    }
    ctx.restore();
  }

  _traceBolt(ctx, x1, y1, x2, y2, seed, segments = 8) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = -dy / length;
    const normalY = dx / length;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let index = 1; index < segments; index += 1) {
      const t = index / segments;
      const raw = Math.sin((seed + index * 17.31) * 12.9898) * 43758.5453;
      const noise = (raw - Math.floor(raw)) * 2 - 1;
      const offset = noise * 30 * Math.sin(Math.PI * t);
      ctx.lineTo(x1 + dx * t + normalX * offset, y1 + dy * t + normalY * offset);
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  _drawThunderCloud(ctx, effect, progress) {
    const age = effect.maxLife - effect.life;
    ctx.save();
    ctx.translate(effect.x, effect.y + Math.sin(age * 8) * 2);
    ctx.globalAlpha = Math.min(0.95, progress * 1.2);
    ctx.fillStyle = '#526b83';
    ctx.shadowColor = effect.color ?? '#58bff3';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.ellipse(-25, 4, 23, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(-9, -5, 22, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(13, -6, 25, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(31, 5, 20, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#dff5ff';
    ctx.globalAlpha *= 0.78;
    ctx.beginPath();
    ctx.ellipse(-11, -13, 9, 5, -0.2, 0, Math.PI * 2);
    ctx.ellipse(12, -15, 10, 5, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawLightningStrike(ctx, effect, progress) {
    const radius = effect.radius ?? 36;
    const seed = effect.seed ?? 1;
    ctx.save();
    ctx.globalAlpha = progress * (effect.isUltimate ? 0.2 : 0.14);
    ctx.fillStyle = effect.color ?? '#78d8ff';
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = progress * 0.85;
    ctx.strokeStyle = effect.color ?? '#58bff3';
    ctx.lineWidth = effect.isUltimate ? 2.5 : 1.8;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius * (0.72 + (1 - progress) * 0.28), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = effect.color ?? '#58bff3';
    ctx.shadowBlur = effect.isUltimate ? 26 : 17;
    ctx.globalAlpha = progress;
    ctx.strokeStyle = effect.color ?? '#58bff3';
    ctx.lineWidth = effect.isUltimate ? 9 : 6;
    this._traceBolt(ctx, effect.fromX ?? effect.x, effect.fromY ?? effect.y - 100, effect.x, effect.y, seed);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = effect.isUltimate ? 3.4 : 2.4;
    this._traceBolt(ctx, effect.fromX ?? effect.x, effect.fromY ?? effect.y - 100, effect.x, effect.y, seed + 0.7);

    const branchX = (effect.fromX ?? effect.x) + (effect.x - (effect.fromX ?? effect.x)) * 0.62;
    const branchY = (effect.fromY ?? effect.y - 100) + (effect.y - (effect.fromY ?? effect.y - 100)) * 0.62;
    ctx.strokeStyle = effect.color ?? '#58bff3';
    ctx.lineWidth = effect.isUltimate ? 3.2 : 2;
    this._traceBolt(ctx, branchX, branchY, branchX + (seed % 2 ? 1 : -1) * 24, branchY + 34, seed + 3.1, 4);

    ctx.shadowBlur = 13;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, effect.isUltimate ? 9 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawEffect(ctx, effect, width, height) {
    const progress = clamp(effect.life / effect.maxLife, 0, 1);
    ctx.save();

    if (effect.type === 'folded-pulse' || effect.type === 'map-mark') {
      ctx.translate(effect.x, effect.y);
      ctx.globalAlpha = progress;
      ctx.strokeStyle = effect.color ?? '#d5a944';
      ctx.fillStyle = effect.color ?? '#d5a944';
      ctx.shadowColor = effect.color ?? '#d5a944';
      ctx.shadowBlur = 12;
      if (effect.type === 'map-mark') {
        const count = effect.count ?? 1;
        for (let i = 0; i < count; i += 1) {
          ctx.fillRect((i - (count - 1) / 2) * 10 - 3, -2, 6, 6);
          ctx.strokeRect((i - (count - 1) / 2) * 10 - 3, -2, 6, 6);
        }
      } else {
        const spread = 28 + (1 - progress) * 28;
        ctx.rotate(effect.angle ?? 0);
        ctx.lineWidth = effect.isFinal ? 4 : 2.5;
        ctx.setLineDash([9, 4]);
        ctx.beginPath();
        ctx.moveTo(-spread, -spread * 0.52);
        ctx.lineTo(0, 0);
        ctx.lineTo(spread, spread * 0.52);
        ctx.stroke();
        ctx.setLineDash([]);
        for (const [x, y] of [[-spread, -spread * 0.52], [0, 0], [spread, spread * 0.52]]) {
          ctx.fillRect(x - 4, y - 4, 8, 8);
          ctx.strokeRect(x - 4, y - 4, 8, 8);
        }
      }
    } else if (effect.type === 'biosphere-bloom' || effect.type === 'biosphere-pulse') {
      ctx.translate(effect.x, effect.y);
      const radius = effect.type === 'biosphere-bloom' ? 124 : 30 + (1 - progress) * 62;
      ctx.globalAlpha = effect.type === 'biosphere-bloom' ? Math.min(0.24, progress * 0.28) : progress * 0.78;
      ctx.strokeStyle = effect.color ?? '#a8c57c';
      ctx.fillStyle = effect.color ?? '#a8c57c';
      ctx.lineWidth = effect.type === 'biosphere-bloom' ? 2 : 3;
      ctx.setLineDash(effect.type === 'biosphere-bloom' ? [5, 8] : []);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (effect.type === 'biosphere-pulse') {
        const glyphs = ['MẦM', 'SƯƠNG', 'GIÓ'];
        const colors = ['#75ae68', '#8bc8d4', '#d4c778'];
        ctx.fillStyle = colors[effect.noteIndex ?? 0];
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.font = 'bold 10px Arial, Helvetica, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeText(glyphs[effect.noteIndex ?? 0], 0, -radius - 4);
        ctx.fillText(glyphs[effect.noteIndex ?? 0], 0, -radius - 4);
        for (let i = 0; i < 3; i += 1) {
          const angle = (i * Math.PI * 2) / 3 - Math.PI / 2;
          ctx.fillRect(Math.cos(angle) * radius * 0.68 - 3, Math.sin(angle) * radius * 0.68 - 3, 6, 6);
        }
      }
    } else if (effect.type === 'thunder-cloud') {
      this._drawThunderCloud(ctx, effect, progress);
    } else if (effect.type === 'lightning-strike' || effect.type === 'thunderbolt') {
      this._drawLightningStrike(ctx, effect, progress);
    } else if (effect.type === 'melee-slash') {
      // High-impact multi-layer crescent energy slash
      const radius = effect.radius || 128;
      const angle = effect.angle ?? 0;
      const facing = effect.facing || 1;
      ctx.translate(effect.x, effect.y);
      ctx.rotate(angle);

      const expand = 1 + (1 - progress) * 0.18;
      const currentRadius = radius * expand;
      const innerRadius = currentRadius * 0.68;
      const arcSpread = 1.15; // Radians

      // Outer neon aura
      ctx.save();
      ctx.globalAlpha = progress * 0.45;
      ctx.fillStyle = '#28d7ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(0, 0, currentRadius + 8, -arcSpread, arcSpread, false);
      ctx.arc(0, 0, innerRadius - 6, arcSpread, -arcSpread, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Main crescent body (cyan gradient)
      ctx.save();
      ctx.globalAlpha = Math.min(1, progress * 1.35);
      ctx.shadowColor = '#6df0ff';
      ctx.shadowBlur = 18;
      const grad = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, currentRadius);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.2)');
      grad.addColorStop(0.5, 'rgba(40, 215, 255, 0.95)');
      grad.addColorStop(1, '#ffffff');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, currentRadius, -arcSpread, arcSpread, false);
      ctx.arc(0, 0, innerRadius, arcSpread, -arcSpread, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Sharp razor-edge core lines
      ctx.save();
      ctx.globalAlpha = progress;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5 * progress + 1;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, currentRadius * 0.96, -arcSpread * 0.95, arcSpread * 0.95);
      ctx.stroke();

      // Forward air razor slices
      ctx.strokeStyle = 'rgba(235, 252, 255, 0.85)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, currentRadius * 1.05, -arcSpread * 0.7, arcSpread * 0.7);
      ctx.stroke();
      ctx.restore();

      // Energy slash sparks
      ctx.save();
      ctx.globalAlpha = progress;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 7; i += 1) {
        const sparkAngle = -arcSpread + (i / 6) * arcSpread * 2;
        const sparkDist = currentRadius + (1 - progress) * 28 + (i % 3) * 6;
        const sx = Math.cos(sparkAngle) * sparkDist;
        const sy = Math.sin(sparkAngle) * sparkDist;
        ctx.fillRect(Math.round(sx - 2), Math.round(sy - 2), 4, 4);
      }
      ctx.restore();

    } else if (effect.type === 'slash-wave') {
      // Epic Reality-Cutting Dimensional Stasis Slash
      const centerX = effect.x ?? width / 2;
      const centerY = effect.y ?? height / 2;
      const reach = Math.hypot(width, height) * 0.68;
      const angle = effect.angle ?? 0;

      ctx.translate(centerX, centerY);
      ctx.rotate(angle);

      // Deep dimensional glow
      ctx.save();
      ctx.globalAlpha = progress * 0.6;
      ctx.strokeStyle = effect.isFinal ? '#e0e7ff' : '#38bdf8';
      ctx.lineWidth = (effect.isFinal ? 22 : 14) * progress;
      ctx.shadowColor = effect.isFinal ? '#c084fc' : '#38bdf8';
      ctx.shadowBlur = 28;
      ctx.beginPath();
      ctx.moveTo(-reach, 0);
      ctx.lineTo(reach, 0);
      ctx.stroke();
      ctx.restore();

      // Tapered razor blade line (diamond beam)
      ctx.save();
      ctx.globalAlpha = progress;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 18;
      const beamHalfWidth = (effect.isFinal ? 6 : 3.8) * progress;
      ctx.beginPath();
      ctx.moveTo(-reach, 0);
      ctx.lineTo(0, -beamHalfWidth);
      ctx.lineTo(reach, 0);
      ctx.lineTo(0, beamHalfWidth);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Lingering dimensional rift scar (jagged spatial scar)
      ctx.save();
      ctx.globalAlpha = progress * 0.85;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-reach * 0.8, 0);
      for (let x = -reach * 0.7; x <= reach * 0.8; x += 36) {
        const offset = Math.sin(x * 0.05 + effect.strikeIndex) * 4 * progress;
        ctx.lineTo(x, offset);
      }
      ctx.stroke();
      ctx.restore();

    } else if (effect.type === 'stasis-shockwave') {
      // Expanding time freeze boundary
      const currentRadius = (1 - progress) * Math.hypot(width, height) * 0.75;
      ctx.save();
      ctx.globalAlpha = progress * 0.85;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 5 * progress + 1;
      ctx.shadowColor = '#67e8f9';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, currentRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Second inner shockwave
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, Math.max(0, currentRadius - 16), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

    } else if (effect.type === 'stasis-impact') {
      // Cross spark burst on target
      ctx.translate(effect.x, effect.y);
      ctx.rotate(effect.angle || 0);
      ctx.globalAlpha = progress;
      const sparkLen = (1 - progress) * 24 + 12;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(-sparkLen, -sparkLen);
      ctx.lineTo(sparkLen, sparkLen);
      ctx.moveTo(-sparkLen, sparkLen);
      ctx.lineTo(sparkLen, -sparkLen);
      ctx.stroke();

      ctx.fillStyle = '#67e8f9';
      for (let i = 0; i < 4; i += 1) {
        const rad = (i * Math.PI) / 2;
        ctx.fillRect(Math.cos(rad) * sparkLen - 2, Math.sin(rad) * sparkLen - 2, 4, 4);
      }

    } else if (effect.type === 'stasis-shatter') {
      // Explosive glass/reality shatter ending Stasis
      ctx.translate(effect.x, effect.y);
      ctx.save();

      // Full-screen white flash fade
      if (progress > 0.75) {
        ctx.globalAlpha = (progress - 0.75) * 4 * 0.45;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-width, -height, width * 2, height * 2);
      }

      // 28 Crystalline glass shards scattering outwards
      for (let i = 0; i < 28; i += 1) {
        const angle = (i * Math.PI * 2) / 28 + (i % 3) * 0.15;
        const speed = 140 + (i % 7) * 45;
        const dist = (1 - progress) * speed * 2;
        const shardX = Math.cos(angle) * dist;
        const shardY = Math.sin(angle) * dist;
        const shardSize = 6 + (i % 5) * 3;

        ctx.save();
        ctx.translate(shardX, shardY);
        ctx.rotate(angle + (1 - progress) * 4);
        ctx.globalAlpha = progress;
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#67e8f9';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -shardSize);
        ctx.lineTo(shardSize * 0.7, shardSize * 0.4);
        ctx.lineTo(-shardSize * 0.6, shardSize * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

    } else if (effect.type === 'burst' || effect.type === 'ultimate-burst' || effect.type === 'victory-burst') {
      const radius = (1 - progress) * (effect.type === 'victory-burst' ? 52 : 23);
      ctx.globalAlpha = progress;
      ctx.fillStyle = effect.color ?? '#ffffff';
      ctx.shadowColor = effect.color ?? '#ffffff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, Math.max(2, radius), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i += 1) {
        const angle = (i * Math.PI) / 4;
        const distance = radius + 3;
        ctx.fillRect(effect.x + Math.cos(angle) * distance - 2, effect.y + Math.sin(angle) * distance - 2, 4, 4);
      }

    } else if (effect.type === 'muzzle') {
      ctx.globalAlpha = progress;
      ctx.fillStyle = effect.color ?? '#ffffff';
      ctx.shadowColor = effect.color ?? '#ffffff';
      ctx.shadowBlur = 12;
      ctx.fillRect(effect.x - 5, effect.y - 4, 10, 8);

    } else if (effect.type === 'rain-flash') {
      ctx.globalAlpha = progress * 0.4;
      ctx.fillStyle = effect.color ?? '#ff9c55';
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 28 + (1 - progress) * 34, 0, Math.PI * 2);
      ctx.fill();

    } else if (effect.type === 'damage-pop') {
      ctx.globalAlpha = progress;
      ctx.fillStyle = '#f04e49';
      ctx.font = 'bold 15px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`-${effect.amount}`, effect.x, effect.y - (1 - progress) * 18);
    }

    ctx.restore();
  }
}
