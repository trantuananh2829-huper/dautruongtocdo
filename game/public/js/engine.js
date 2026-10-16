import { GAME_CONFIG } from './data.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randomBetween = (min, max) => min + Math.random() * (max - min);
const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export class BattleEngine {
  constructor(leftCharacter, rightCharacter, { onSound = () => {} } = {}) {
    this.onSound = onSound;
    this.bounds = { width: 960, height: 540 };
    this.sequence = 0;
    this.reset(leftCharacter, rightCharacter);
  }

  reset(leftCharacter, rightCharacter) {
    this.elapsed = 0;
    this.projectiles = [];
    this.effects = [];
    this.result = null;
    this.running = true;
    const { width, height } = this.bounds;
    const makeFighter = (character, side, index) => ({
      id: `${character.id}-${side}-${this.sequence++}`,
      character,
      side,
      x: side === 'left' ? width * 0.22 : width * 0.78,
      y: height * (index === 0 ? 0.5 : 0.5),
      vx: side === 'left' ? 70 : -70,
      vy: randomBetween(-38, 38),
      hp: character.stats.max_hp,
      maxHp: character.stats.max_hp,
      attackSpeed: character.stats.attack_speed_start,
      shotTimer: randomBetween(0.18, 0.62),
      energy: 0,
      ultimateState: null,
      moveTimer: randomBetween(0.8, 1.8),
      flash: 0,
      stunTimer: 0,
      slashAnim: 0,
      slashDuration: 0.28,
      knockbackX: 0,
      knockbackY: 0,
      alive: true,
      facing: side === 'left' ? 1 : -1,
      surveyHits: 0,
      noteIndex: 0,
      attackSlowTimer: 0,
      noteStatus: null,
    });
    this.fighters = [makeFighter(leftCharacter, 'left', 0), makeFighter(rightCharacter, 'right', 1)];
  }

  setBounds(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 160 || height < 140) return;
    const previousWidth = this.bounds.width;
    const previousHeight = this.bounds.height;
    this.bounds = { width, height };
    const inset = GAME_CONFIG.arenaInset + 12;
    for (const fighter of this.fighters) {
      fighter.x = clamp(fighter.x * (width / previousWidth), inset, width - inset);
      fighter.y = clamp(fighter.y * (height / previousHeight), inset, height - inset);
    }
  }

  update(rawDelta) {
    if (!this.running) return;
    const dt = clamp(rawDelta || 0, 0, GAME_CONFIG.maxDeltaSeconds);
    this.elapsed += dt;
    this._updateEffects(dt);

    if (this.result) {
      this._moveWinner(dt);
      return;
    }

    const stasisWasActive = this.fighters.some((fighter) => fighter.ultimateState?.kind === 'world_stasis');
    for (const fighter of this.fighters) {
      if (!fighter.alive) continue;
      fighter.flash = Math.max(0, fighter.flash - dt);
      fighter.slashAnim = Math.max(0, (fighter.slashAnim || 0) - dt);
      fighter.attackSlowTimer = Math.max(0, (fighter.attackSlowTimer || 0) - dt);
      if (fighter.noteStatus) {
        fighter.noteStatus.timer -= dt;
        if (fighter.noteStatus.timer <= 0) fighter.noteStatus = null;
      }
      fighter.attackSpeed = this._attackSpeedFor(fighter.character, this.elapsed) * (fighter.attackSlowTimer > 0 ? 0.84 : 1);
      if (!stasisWasActive) fighter.stunTimer = Math.max(0, fighter.stunTimer - dt);
      const opponent = this._opponent(fighter);
      fighter.energy = Math.min(100, fighter.energy + (fighter.character.ultimate.passive_charge_per_second ?? 2.7) * dt);
      if (fighter.energy >= 100 && !fighter.ultimateState) this._activateUltimate(fighter, opponent);
    }

    const worldStasisActive = this.fighters.some((fighter) => fighter.ultimateState?.kind === 'world_stasis');
    for (const fighter of this.fighters) {
      if (!fighter.alive) continue;
      const opponent = this._opponent(fighter);
      if (!worldStasisActive) {
        if (fighter.ultimateState?.kind === 'little_biosphere') {
          fighter.vx = 0;
          fighter.vy = 0;
        } else {
          fighter.moveTimer -= dt;
          if (fighter.moveTimer <= 0 && fighter.stunTimer <= 0) this._chooseDirection(fighter, opponent);
        }
        this._moveFighter(fighter, dt);
      }
      if (!worldStasisActive || fighter.ultimateState?.kind === 'world_stasis') this._updateUltimate(fighter, opponent, dt);
      if (!worldStasisActive && !fighter.ultimateState && fighter.stunTimer <= 0) {
        fighter.shotTimer -= dt;
        const attack = fighter.character.attack ?? fighter.character.projectile;
        const interval = (attack.base_fire_rate ?? 1) / fighter.attackSpeed;
        if (fighter.shotTimer <= 0) {
          this._performAttack(fighter, opponent);
          fighter.shotTimer += interval;
        }
      }
    }

    this._updateProjectiles(dt);
    this._checkProjectileClashes();
    this._checkProjectileHits();
    this._checkResult();
  }

  _attackSpeedFor(character, time) {
    const start = character.stats.attack_speed_start;
    const max = character.stats.attack_speed_max;
    const progress = clamp(time / GAME_CONFIG.attackSpeedRampSeconds, 0, 1);
    return Math.min(max, start + (max - start) * progress);
  }

  _opponent(fighter) {
    return this.fighters.find((candidate) => candidate.side !== fighter.side);
  }

  _chooseDirection(fighter, opponent) {
    const dx = opponent.x - fighter.x;
    const dy = opponent.y - fighter.y;
    const toTarget = Math.atan2(dy, dx);
    const attack = fighter.character.attack;
    const distance = Math.hypot(dx, dy);
    let angle;
    let speed;
    if (attack?.kind === 'melee_aoe' && distance > (attack.aoe_radius ?? 128) * 0.78) {
      angle = toTarget + randomBetween(-0.16, 0.16);
      speed = GAME_CONFIG.baseFighterSpeed * randomBetween(1.05, 1.2);
    } else {
      const dodge = Math.random() < 0.45 ? Math.PI / 2 : -Math.PI / 2;
      angle = toTarget + dodge * randomBetween(0.3, 0.8) + randomBetween(-0.8, 0.8);
      speed = GAME_CONFIG.baseFighterSpeed * randomBetween(0.72, 1.22);
    }
    fighter.vx = Math.cos(angle) * speed;
    fighter.vy = Math.sin(angle) * speed;
    fighter.facing = dx >= 0 ? 1 : -1;
    fighter.moveTimer = randomBetween(0.65, 1.55);
  }

  _moveFighter(fighter, dt) {
    const { width, height } = this.bounds;
    const inset = GAME_CONFIG.arenaInset + 16;
    fighter.previousX = fighter.x;
    fighter.previousY = fighter.y;
    fighter.x += (fighter.stunTimer > 0 ? 0 : fighter.vx) * dt + fighter.knockbackX * dt;
    fighter.y += (fighter.stunTimer > 0 ? 0 : fighter.vy) * dt + fighter.knockbackY * dt;
    const knockbackDecay = Math.exp(-dt * 16);
    fighter.knockbackX *= knockbackDecay;
    fighter.knockbackY *= knockbackDecay;
    if (Math.abs(fighter.knockbackX) < 2) fighter.knockbackX = 0;
    if (Math.abs(fighter.knockbackY) < 2) fighter.knockbackY = 0;
    if (fighter.x < inset || fighter.x > width - inset) {
      fighter.x = clamp(fighter.x, inset, width - inset);
      fighter.vx *= -1;
      fighter.knockbackX *= -0.35;
    }
    if (fighter.y < inset || fighter.y > height - inset) {
      fighter.y = clamp(fighter.y, inset, height - inset);
      fighter.vy *= -1;
      fighter.knockbackY *= -0.35;
    }
    return;
  }

  _fire(fighter, opponent) {
    const config = fighter.character.projectile;
    const note = config.notes?.length ? config.notes[fighter.noteIndex++ % config.notes.length] : null;
    const speedScale = 1 + (fighter.attackSpeed - 1) * 0.45;
    const burstCount = clamp(1 + Math.floor((fighter.attackSpeed - 1 + 0.001) / 0.54), 1, 3);
    const baseAngle = Math.atan2(opponent.y - fighter.y, opponent.x - fighter.x);
    const spread = config.spread_radians ?? 0.1;
    for (let i = 0; i < burstCount; i += 1) {
      const offset = burstCount === 1 ? 0 : (i - (burstCount - 1) / 2) * spread;
      const angle = baseAngle + offset;
      const speed = (config.base_speed ?? 360) * speedScale;
      this.projectiles.push({
        id: this.sequence++,
        side: fighter.side,
        kind: config.kind ?? 'energy_blade',
        type: config.type,
        note,
        color: config.color ?? '#28d7ff',
        x: fighter.x + Math.cos(angle) * 25,
        y: fighter.y + Math.sin(angle) * 25,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: GAME_CONFIG.projectileRadius,
        damage: config.damage ?? clamp(1 + Math.floor(this.elapsed / 34), 1, 3),
        trail: [],
        frozenUntil: 0,
        dead: false,
        life: 5,
      });
    }
    this.effects.push({ type: 'muzzle', x: fighter.x + fighter.facing * 18, y: fighter.y - 1, color: note?.color ?? config.color ?? '#28d7ff', life: 0.18, maxLife: 0.18 });
    this.onSound(note ? `bell_${note.glyph}` : config.kind === 'arrow' ? 'arrow' : config.kind === 'anchor_pin' ? 'map_pin' : 'slash');
  }

  _performAttack(fighter, opponent) {
    if (fighter.character.attack?.kind === 'melee_aoe') {
      this._meleeAttack(fighter, opponent);
      return;
    }
    if (fighter.character.attack?.kind === 'lightning_aoe') {
      this._lightningAttack(fighter, opponent);
      return;
    }
    this._fire(fighter, opponent);
  }

  _meleeAttack(fighter, opponent) {
    const attack = fighter.character.attack;
    const dx = opponent.x - fighter.x;
    const dy = opponent.y - fighter.y;
    const angle = Math.atan2(dy, dx);
    fighter.facing = dx >= 0 ? 1 : -1;
    fighter.slashAnim = 0.28;
    fighter.slashDuration = 0.28;
    const radius = attack.aoe_radius ?? 128;
    this.effects.push({
      type: 'melee-slash', x: fighter.x + fighter.facing * 14, y: fighter.y - 3, angle, radius,
      life: 0.32, maxLife: 0.32, color: attack.color ?? fighter.character.sprite.accent,
      facing: fighter.facing,
    });
    const range = attack.range ?? radius;
    const halfArc = (attack.arc_radians ?? 2.2) / 2;
    const damage = clamp(1 + Math.floor(this.elapsed / 34), 1, 3);
    for (const target of this.fighters) {
      if (target.side === fighter.side || !target.alive) continue;
      const targetX = target.x - fighter.x;
      const targetY = target.y - fighter.y;
      const distance = Math.hypot(targetX, targetY);
      const forwardDot = distance === 0 ? 1 : (targetX * fighter.facing) / distance;
      if (distance > range || forwardDot < Math.cos(halfArc)) continue;
      this._dealDamage(target, damage, fighter, {
        stunSeconds: attack.stun_seconds ?? 0.38,
        knockbackSpeed: attack.knockback_speed ?? 185,
      });
      this._burst(target.x, target.y, '#f5fcff');
    }
    this.onSound('slash');
  }

  _lightningAttack(fighter, opponent) {
    const attack = fighter.character.attack;
    const impactX = clamp(opponent.x + randomBetween(-22, 22), GAME_CONFIG.arenaInset + 12, this.bounds.width - GAME_CONFIG.arenaInset - 12);
    const impactY = clamp(opponent.y + randomBetween(-22, 22), GAME_CONFIG.arenaInset + 12, this.bounds.height - GAME_CONFIG.arenaInset - 12);
    const radius = attack.aoe_radius ?? 178;
    this.effects.push({
      type: 'lightning-strike', x: impactX, y: impactY,
      fromX: impactX + randomBetween(-18, 18), fromY: Math.max(20, impactY - 142),
      radius, color: attack.color ?? '#78d8ff', seed: this.sequence++,
      life: 0.42, maxLife: 0.42, isUltimate: false,
    });
    for (const target of this.fighters) {
      if (target.side === fighter.side || !target.alive) continue;
      if (Math.hypot(target.x - impactX, target.y - impactY) > radius) continue;
      this._dealDamage(target, attack.damage ?? 2, fighter, { knockbackSpeed: attack.knockback_speed ?? 90 });
    }
    this.onSound('lightning');
  }

  _activateUltimate(fighter, opponent) {
    const spec = fighter.character.ultimate;
    fighter.energy = 0;
    fighter.ultimateState = {
      kind: spec.kind, elapsed: 0, duration: spec.duration_seconds,
      nextPulse: ['thunderstorm', 'folded_atlas', 'little_biosphere'].includes(spec.kind) ? 0.08 : 0,
      nextRain: 0.06, strikes: 0, cloudEffect: null,
    };
    this.effects.push({ type: 'ultimate-burst', x: fighter.x, y: fighter.y, color: fighter.character.sprite.accent, life: 0.65, maxLife: 0.65 });
    if (spec.kind === 'world_stasis') {
      this.onSound('stasis_start');
      this.effects.push({
        type: 'stasis-shockwave', x: fighter.x, y: fighter.y,
        life: 0.62, maxLife: 0.62, color: '#38bdf8',
      });
      for (const projectile of this.projectiles) {
        if (projectile.side !== fighter.side) projectile.frozenUntil = Math.max(projectile.frozenUntil, this.elapsed + spec.duration_seconds);
      }
    } else if (spec.kind === 'thunderstorm') {
      this.onSound('thunder');
      const cloudEffect = {
        type: 'thunder-cloud', x: opponent.x, y: Math.max(24, opponent.y - 88),
        color: spec.color ?? '#58bff3', ownerSide: fighter.side,
        life: spec.duration_seconds, maxLife: spec.duration_seconds,
      };
      this.effects.push(cloudEffect);
      fighter.ultimateState.cloudEffect = cloudEffect;
    } else if (spec.kind === 'folded_atlas') {
      this.onSound('map_fold');
    } else if (spec.kind === 'little_biosphere') {
      this.onSound('biosphere');
      this.effects.push({ type: 'biosphere-bloom', x: fighter.x, y: fighter.y, color: fighter.character.sprite.accent, life: spec.duration_seconds, maxLife: spec.duration_seconds });
    } else {
      this.onSound('ultimate');
    }
    // Effect behavior is selected by the data-level ultimate kind, not character identity.
    if (!['world_stasis', 'spatial_rend', 'thunderstorm', 'folded_atlas', 'little_biosphere'].includes(spec.kind)) {
      fighter.ultimateState.kind = 'generic_surge';
      fighter.ultimateState.nextPulse = 0.24;
    }
    opponent.facing = opponent.x < fighter.x ? 1 : -1;
  }

  _updateUltimate(fighter, opponent, dt) {
    const state = fighter.ultimateState;
    if (!state) return;
    state.elapsed += dt;
    if (state.kind === 'world_stasis') {
      const spec = fighter.character.ultimate;
      const slashCount = Math.max(1, Math.floor(spec.slash_count ?? 20));
      const interval = state.duration / slashCount;
      while (state.elapsed >= state.nextPulse && state.strikes < slashCount) {
        const angle = Math.random() * Math.PI * 2;
        const targetX = opponent.alive ? opponent.x : this.bounds.width / 2;
        const targetY = opponent.alive ? opponent.y : this.bounds.height / 2;
        this.effects.push({
          type: 'slash-wave', x: targetX, y: targetY, angle,
          strikeIndex: state.strikes, isFinal: state.strikes === slashCount - 1,
          life: 0.36, maxLife: 0.36, color: '#ffffff',
        });
        if (opponent.alive) {
          this._dealDamage(opponent, spec.damage_per_slash ?? 2, fighter, { knockbackSpeed: 0, chargeUltimate: false });
          this.effects.push({
            type: 'stasis-impact', x: opponent.x, y: opponent.y,
            angle, life: 0.28, maxLife: 0.28, color: '#67e8f9',
          });
        }
        this.onSound('stasis_slash');
        state.strikes += 1;
        state.nextPulse += interval;
      }
      if (state.elapsed >= state.duration) {
        this.effects.push({
          type: 'stasis-shatter', x: this.bounds.width / 2, y: this.bounds.height / 2,
          life: 0.68, maxLife: 0.68,
        });
        this.onSound('stasis_shatter');
        fighter.ultimateState = null;
      }
    } else if (state.kind === 'thunderstorm') {
      const spec = fighter.character.ultimate;
      const boltCount = Math.max(1, Math.floor(spec.bolt_count ?? 8));
      const interval = state.duration / boltCount;
      const cloudX = opponent.alive ? opponent.x : this.bounds.width / 2;
      const cloudY = Math.max(24, (opponent.alive ? opponent.y : this.bounds.height / 2) - 88);
      if (state.cloudEffect) {
        state.cloudEffect.x = cloudX;
        state.cloudEffect.y = cloudY;
      }
      while (state.elapsed >= state.nextPulse && state.strikes < boltCount) {
        const impactX = clamp(cloudX + randomBetween(-34, 34), GAME_CONFIG.arenaInset + 12, this.bounds.width - GAME_CONFIG.arenaInset - 12);
        const impactY = clamp((opponent.alive ? opponent.y : this.bounds.height / 2) + randomBetween(-24, 24), GAME_CONFIG.arenaInset + 12, this.bounds.height - GAME_CONFIG.arenaInset - 12);
        const radius = spec.aoe_radius ?? 112;
        this.effects.push({
          type: 'thunderbolt', x: impactX, y: impactY,
          fromX: cloudX + randomBetween(-22, 22), fromY: cloudY + 16,
          radius, color: spec.color ?? '#58bff3', seed: this.sequence++,
          life: 0.44, maxLife: 0.44, isUltimate: true,
        });
        for (const target of this.fighters) {
          if (target.side === fighter.side || !target.alive) continue;
          if (Math.hypot(target.x - impactX, target.y - impactY) > radius) continue;
          this._dealDamage(target, spec.damage_per_bolt ?? 10, fighter, { knockbackSpeed: 180, chargeUltimate: false });
        }
        this.onSound('thunder');
        state.strikes += 1;
        state.nextPulse += interval;
      }
    } else if (state.kind === 'folded_atlas' || state.kind === 'little_biosphere') {
      const spec = fighter.character.ultimate;
      const pulseCount = Math.max(1, Math.floor(spec.pulse_count ?? 8));
      const interval = state.duration / pulseCount;
      while (state.elapsed >= state.nextPulse && state.strikes < pulseCount) {
        const noteIndex = state.strikes % 3;
        const angle = state.strikes * 2.399963229728653;
        const spread = state.kind === 'folded_atlas' ? 19 : (spec.aoe_radius ?? 130) * 0.22;
        const centerX = clamp((opponent.alive ? opponent.x : this.bounds.width / 2) + Math.cos(angle) * spread, GAME_CONFIG.arenaInset + 14, this.bounds.width - GAME_CONFIG.arenaInset - 14);
        const centerY = clamp((opponent.alive ? opponent.y : this.bounds.height / 2) + Math.sin(angle) * spread, GAME_CONFIG.arenaInset + 14, this.bounds.height - GAME_CONFIG.arenaInset - 14);
        const effectType = state.kind === 'folded_atlas' ? 'folded-pulse' : 'biosphere-pulse';
        this.effects.push({ type: effectType, x: centerX, y: centerY, angle, pulseIndex: state.strikes, noteIndex, color: fighter.character.sprite.accent, life: 0.48, maxLife: 0.48, isFinal: state.strikes === pulseCount - 1 });
        const target = opponent;
        if (target.alive && Math.hypot(target.x - centerX, target.y - centerY) <= (spec.aoe_radius ?? 130)) {
          const note = state.kind === 'little_biosphere' ? spec.notes?.[noteIndex] : null;
          const options = { knockbackSpeed: note?.glyph === 'gust' ? 175 : state.kind === 'folded_atlas' ? 105 : 70, chargeUltimate: false };
          if (note?.glyph === 'leaf') options.stunSeconds = 0.12;
          this._dealDamage(target, spec.damage_per_pulse ?? 3, fighter, options);
          if (note?.glyph === 'dew') {
            target.attackSlowTimer = Math.max(target.attackSlowTimer || 0, 0.72);
            target.noteStatus = { glyph: note.glyph, timer: 0.72 };
          } else if (note) {
            target.noteStatus = { glyph: note.glyph, timer: 0.42 };
          }
        }
        this.onSound(state.kind === 'little_biosphere' ? `bell_${spec.notes?.[noteIndex]?.glyph ?? 'leaf'}` : 'map_fold');
        state.strikes += 1;
        state.nextPulse += interval;
      }
    } else if (state.kind === 'spatial_rend') {
      while (state.elapsed >= state.nextRain && state.nextRain < state.duration) {
        const spec = fighter.character.ultimate;
        const rainCount = Math.max(1, Math.floor(spec.arrows_per_rain ?? (fighter.attackSpeed >= 1.6 ? 4 : 3)));
        for (let i = 0; i < rainCount; i += 1) {
          const x = clamp(opponent.x + randomBetween(-125, 125), GAME_CONFIG.arenaInset + 12, this.bounds.width - GAME_CONFIG.arenaInset - 12);
          this.projectiles.push({
            id: this.sequence++, side: fighter.side, kind: 'rain_arrow', type: 'mưa tên', color: '#ff8c45', ultimate: true,
            x, y: GAME_CONFIG.arenaInset + 2, vx: randomBetween(-16, 16), vy: randomBetween(280, 360),
            radius: 4, damage: spec.damage_per_arrow ?? 2, trail: [], frozenUntil: 0, dead: false, life: 2.2,
          });
        }
        this.effects.push({ type: 'rain-flash', x: opponent.x, y: opponent.y, life: 0.22, maxLife: 0.22, color: '#ff9c55' });
        state.nextRain += spec.rain_interval_seconds ?? 0.2;
      }
    } else if (state.kind === 'generic_surge' && state.elapsed >= state.nextPulse) {
      state.nextPulse += 0.48;
      this.effects.push({ type: 'slash-wave', x: this.bounds.width / 2, y: opponent.y, life: 0.42, maxLife: 0.42, color: fighter.character.projectile.color });
      this._dealDamage(opponent, 3, fighter, { chargeUltimate: false });
    }
    if (state.elapsed >= state.duration) fighter.ultimateState = null;
  }

  _updateProjectiles(dt) {
    for (const projectile of this.projectiles) {
      if (projectile.dead) continue;
      if (this.elapsed < (projectile.frozenUntil ?? 0)) {
        projectile.frozen = true;
        projectile.previousX = projectile.x;
        projectile.previousY = projectile.y;
        continue;
      }
      projectile.frozen = false;
      projectile.frozenUntil = 0;
      projectile.previousX = projectile.x;
      projectile.previousY = projectile.y;
      projectile.trail.unshift({ x: projectile.x, y: projectile.y });
      if (projectile.trail.length > 7) projectile.trail.pop();
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;
      const { width, height } = this.bounds;
      const margin = GAME_CONFIG.arenaInset;
      if (projectile.life <= 0 || projectile.x < margin || projectile.x > width - margin || projectile.y < margin || projectile.y > height - margin) {
        projectile.dead = true;
      }
    }
    this.projectiles = this.projectiles.filter((projectile) => !projectile.dead);
  }

  _checkProjectileClashes() {
    for (let i = 0; i < this.projectiles.length; i += 1) {
      const first = this.projectiles[i];
      if (first.dead || first.frozen || this.elapsed < first.frozenUntil) continue;
      for (let j = i + 1; j < this.projectiles.length; j += 1) {
        const second = this.projectiles[j];
        if (second.dead || second.frozen || this.elapsed < second.frozenUntil || first.side === second.side) continue;
        const range = first.radius + second.radius + 4;
        if (distanceSquared(first, second) <= range * range || this._segmentsTouch(first.previousX, first.previousY, first.x, first.y, second.previousX, second.previousY, second.x, second.y, range)) {
          first.dead = true;
          second.dead = true;
          this._burst((first.x + second.x) / 2, (first.y + second.y) / 2, '#ffd36e');
          this.onSound('impact');
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((projectile) => !projectile.dead);
  }

  _checkProjectileHits() {
    for (const projectile of this.projectiles) {
      if (projectile.dead || projectile.frozen || this.elapsed < projectile.frozenUntil) continue;
      const target = this.fighters.find((fighter) => fighter.side !== projectile.side);
      if (!target?.alive) continue;
      const range = projectile.radius + 15;
      const crossedPath = this._segmentsTouch(
        projectile.previousX ?? projectile.x,
        projectile.previousY ?? projectile.y,
        projectile.x,
        projectile.y,
        target.previousX ?? target.x,
        target.previousY ?? target.y,
        target.x,
        target.y,
        range,
      );
      if (distanceSquared(projectile, target) <= range * range || crossedPath) {
        projectile.dead = true;
        const attacker = this.fighters.find((fighter) => fighter.side === projectile.side);
        const note = projectile.note;
        const hitOptions = { chargeUltimate: !projectile.ultimate };
        if (note) {
          hitOptions.knockbackSpeed = note.glyph === 'gust' ? 195 : 145;
          if (note.glyph === 'leaf') hitOptions.stunSeconds = 0.14;
        }
        this._dealDamage(target, projectile.damage, attacker, hitOptions);
        if (note?.glyph === 'dew') {
          target.attackSlowTimer = Math.max(target.attackSlowTimer || 0, 0.9);
          target.noteStatus = { glyph: 'dew', timer: 0.9 };
        } else if (note) {
          target.noteStatus = { glyph: note.glyph, timer: 0.45 };
        }
        if (projectile.kind === 'anchor_pin' && attacker) {
          attacker.surveyHits = (attacker.surveyHits + 1) % 3;
          this.effects.push({ type: 'map-mark', x: target.x, y: target.y - 34, count: attacker.surveyHits || 3, color: attacker.character.sprite.accent, life: 0.62, maxLife: 0.62 });
          if (attacker.surveyHits === 0) {
            this.effects.push({ type: 'folded-pulse', x: target.x, y: target.y, angle: Math.atan2(target.y - attacker.y, target.x - attacker.x), pulseIndex: 0, noteIndex: 0, color: attacker.character.sprite.accent, life: 0.55, maxLife: 0.55, isFinal: false });
            this._dealDamage(target, 2, attacker, { knockbackSpeed: 0, chargeUltimate: false });
          }
        }
        this._burst(projectile.x, projectile.y, projectile.color);
        this.onSound('impact');
      }
    }
    this.projectiles = this.projectiles.filter((projectile) => !projectile.dead);
  }

  _segmentsTouch(ax, ay, bx, by, cx, cy, dx, dy, padding) {
    if (![ax, ay, bx, by, cx, cy, dx, dy].every(Number.isFinite)) return false;
    const relativeX = ax - cx;
    const relativeY = ay - cy;
    const velocityX = (bx - ax) - (dx - cx);
    const velocityY = (by - ay) - (dy - cy);
    const speedSquared = velocityX * velocityX + velocityY * velocityY;
    const progress = speedSquared === 0 ? 0 : clamp(-(relativeX * velocityX + relativeY * velocityY) / speedSquared, 0, 1);
    const closestX = relativeX + velocityX * progress;
    const closestY = relativeY + velocityY * progress;
    return closestX * closestX + closestY * closestY <= padding * padding;
  }

  _dealDamage(target, amount, attacker, { stunSeconds = 0, knockbackSpeed = 145, chargeUltimate = true } = {}) {
    if (!target?.alive || this.result) return;
    target.hp = Math.max(0, target.hp - amount);
    target.flash = 0.16;
    if (stunSeconds > 0) target.stunTimer = Math.max(target.stunTimer, stunSeconds);
    this.effects.push({ type: 'damage-pop', x: target.x, y: target.y - 26, life: 0.42, maxLife: 0.42, amount });
    if (attacker && chargeUltimate) attacker.energy = Math.min(100, attacker.energy + (attacker.character.ultimate.hit_charge ?? 9));
    if (attacker && knockbackSpeed > 0) {
      const dx = target.x - attacker.x;
      const dy = target.y - attacker.y;
      const distance = Math.hypot(dx, dy);
      const nx = distance > 0 ? dx / distance : attacker.side === 'left' ? 1 : -1;
      const ny = distance > 0 ? dy / distance : 0;
      target.knockbackX = clamp(target.knockbackX + nx * knockbackSpeed, -260, 260);
      target.knockbackY = clamp(target.knockbackY + ny * knockbackSpeed, -260, 260);
    }
    if (target.hp <= 0) target.alive = false;
  }

  _burst(x, y, color) {
    this.effects.push({ type: 'burst', x, y, color, life: 0.38, maxLife: 0.38 });
  }

  _checkResult() {
    const loser = this.fighters.find((fighter) => !fighter.alive);
    if (!loser) return;
    const winner = this._opponent(loser);
    this.result = { winnerSide: winner.side, loserSide: loser.side, elapsed: 0 };
    this.projectiles = [];
    this.onSound('win');
    this.effects.push({ type: 'victory-burst', x: loser.x, y: loser.y, color: '#ffffff', life: 0.95, maxLife: 0.95 });
  }

  _moveWinner(dt) {
    const winner = this.fighters.find((fighter) => fighter.side === this.result.winnerSide);
    this.result.elapsed += dt;
    winner.moveTimer -= dt;
    if (winner.moveTimer <= 0) this._chooseDirection(winner, this.fighters.find((fighter) => fighter.side !== winner.side));
    this._moveFighter(winner, dt);
    this._updateEffects(dt);
  }

  _updateEffects(dt) {
    const stasisActive = this.fighters.some((fighter) => fighter.ultimateState?.kind === 'world_stasis');
    for (const effect of this.effects) {
      const owner = effect.type === 'thunder-cloud' ? this.fighters.find((fighter) => fighter.side === effect.ownerSide) : null;
      const pausedCloud = stasisActive && effect.type === 'thunder-cloud' && owner?.ultimateState?.kind !== 'world_stasis';
      if (!pausedCloud) effect.life -= dt;
    }
    this.effects = this.effects.filter((effect) => effect.life > 0);
  }
}
