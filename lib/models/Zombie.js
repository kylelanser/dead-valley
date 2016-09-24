define(["Vector",
        "SpriteModel",
        "Collidable",
        "Game",
        "Timeout",
        "fx/BulletHit",
        "fx/BloodSplatter",
        "fx/Audio",
        "Reporter"],

        function(Vector,
                 SpriteModel,
                 Collidable,
                 Game,
                 Timeout,
                 BulletHit,
                 BloodSplatter,
                 Audio,
                 Reporter) {

  var LEFT  = true;  // true, meaning do flip the sprite
  var RIGHT = false;

  var ATTACK_SPEED  = 0.50; // in seconds
  var DAMAGE_WINDOW = 0.02; // in seconds

  var MIN_SPEED                      = 11;   // 5 MPH
  var MAX_SPEED                      = 55;   // 25 MPH
  var SCAN_TIMEOUT_RESET             = 1;    // in seconds
  var MAX_WAIT_TIME                  = 20;   // in seconds
  var DEAD_BODY_LIFE                 = 45;   // in seconds
  var DEAD_BODY_FADE                 = 5;    // in seconds
  var MAX_RANGE                      = 400;  // how far a Zombie can see - in pixels
  var WANDER_DISTANCE                = 200;  // how far a Zombie wanders in one direction - in pixels
  var HEALTH                         = 60;
  var TAKING_DAMAGE_TIMEOUT          = 0.1;  // in seconds

  var bulletHit = new BulletHit({
    color:     'green',
    minLength: 10,
    range:     15,
    size:      2
  });

  var headshotBulletHit = new BulletHit({
    color:     'green',
    minLength: 15,
    range:     20,
    size:      2
  });

  var Zombie = function () {
    this.init('Zombie');

    // set some counters randomly so not all zombies are in sync

    this.target                = null;
    this.targetSprite          = null;
    this.seeTarget             = false;
    this.direction             = RIGHT;
    this.walking               = false;
    this.scanTimeout           = SCAN_TIMEOUT_RESET * Math.random();
    this.waitTimeout           = MAX_WAIT_TIME * Math.random();

    this.elapsedAttackTime     = 0;

    this.currentState          = this.states.wandering;

    this.mass                  = 0.001;
    this.inertia               = 1;

    this.health                = HEALTH;

    this.prone                 = false;

    this.moseySpeed  = MIN_SPEED + Math.random();
    this.attackSpeed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
  };
  Zombie.prototype = new SpriteModel();

  Zombie.prototype.isZombie = true;

  Zombie.prototype.lookForTargets = function () {
    // dude is the only target for now
    if (!Game.dude) {
      return;
    }
    this.seeTarget = false;
    var target = Game.dude.driving || Game.dude;
    if (target &&
        target.visible &&
        this.position.subtract(target.position).magnitude() < MAX_RANGE) {
      var see = false;
      Game.map.rayTrace(this.position, target.position, MAX_RANGE, function (collision, sprite) {
        if (sprite === target) {
          see = true;
        }
       
        // look past other zombies
        // keep going if there isn't a collision
        // stop if you see the dude
        return sprite.isZombie || !collision || see;
      });
      if (see) {
        // only make the 'see' noise if the zombie didn't already see the dude
        if (this.currentState !== this.states.stalking) {
          Audio['zombie-see'].playRandom();
        }

        this.setTarget(target);
      }
    }
  };

  Zombie.prototype.setTarget = function (target) {
    this.target       = target.position.clone();
    this.target.retain();
    this.targetVel    = target.velocity.clone();
    this.targetVel.retain();
    this.seeTarget    = true;
    this.targetSprite = target;
  };

  Zombie.prototype.clearTarget = function () {
    this.target       = null;
    this.targetSprite = null;
    this.targetVel    = null;
    this.seeTarget    = false;
  };

  Zombie.prototype.preMove = function (delta) {
    if (this.health <= 0) {
      this.waitTimeout += delta;
      if (this.waitTimeout > DEAD_BODY_LIFE) {
        this.die();
      }
      return;
    }

    this.scanTimeout -= delta;
    if (this.scanTimeout < 0) {
      this.scanTimeout = SCAN_TIMEOUT_RESET;
      this.lookForTargets();
    }

    this.currentState.call(this, delta);

    this.handleAttack(delta);

    if (this.velocity.x) {
      this.direction = (this.velocity.x > 0) ? RIGHT : LEFT;
    }

    if (this.seeTarget) {
      this.currentState = this.states.stalking;
    }
  };

  Zombie.prototype.postMove = function (delta) {
    if (!this.audioPlaying &&
        this.attackingFrame === 3) { // arm stretched
      this.audioPlaying = true;
      Audio['zombie-attack'].playRandom();
    } else if (this.attackingFrame === 0) {
      this.audioPlaying = false;
    }
  };

  Zombie.prototype.handleAttack = function (delta) {
    this.inDamageWindow = false;

    if (this.currentState === this.states.attacking ||
        this.elapsedAttackTime > 0) {  // want to finish his animation
      this.elapsedAttackTime += delta;
      if (this.elapsedAttackTime > ATTACK_SPEED) {
        this.elapsedAttackTime = 0;
      } else if (ATTACK_SPEED - this.elapsedAttackTime < DAMAGE_WINDOW) {
        this.inDamageWindow = true;
      }
    }
  };

  Zombie.prototype.hit = function (other) {
    // are we in the window of opportunity?
    if (other.takeDamage && this.inDamageWindow) {
      var which = (this.direction === RIGHT) ? 1 : -1;
      var add = Vector.create(which * this.tileWidth, 0);
      other.takeDamage(10, this.position.add(add), this);
    }
  };

  Zombie.prototype.findEndOfObstacle = function (obstacle, point, normal) {
    var parallel = normal.normal();
    var dot = parallel.dotProduct(this.velocity);
    var newDir = parallel.scale(dot).normalize();
    // which of the obstacle's points is closest in line which the direction
    // we want to go?
    var points = obstacle.transformedPoints();
    var length = points.length;
    var i, max = 0;
    var testPoint;
    for (i = 0; i < length; i++) {
      testPoint = points[i].subtract(obstacle.position);
      dot = testPoint.dotProduct(newDir);
      max = Math.max(max, dot);
      if (dot === max) {
        point = testPoint;
      }
    }
    var extra = point.clone().normalize().scale(20);
    newDir.scale(20);

    // new target
    this.target = point.add(extra).translate(newDir).translate(obstacle.position);
    this.target.retain();
  };

  Zombie.prototype.collision = function (other, point, normal, vab) {
    // zombies don't rotate
    this.position.rot = 0;
    this.velocity.rot = 0;

    // ignore inventory drops
    if (other.touchOnly) {
      return;
    }

    var dude = Game.dude;
    if (dude && // make sure the dude is alive and well
        (other === dude ||
         other === dude.driving ||
         (other === dude.inside &&
          this.currentState === this.states.pounding))) {
      this.currentState = this.states.attacking;

      this.hit(other);
    } else if (this.currentState !== this.states.attacking &&
               !other.isZombie &&
               this.velocity.dotProduct(normal) < 0) {
      this.lastState = this.currentState;
      this.lastTarget = this.target;
      this.currentState = this.states.avoiding;
      this.findEndOfObstacle(other, point, normal);
    }

    var magnitude = vab.magnitude();
    if (magnitude > 132) { // 30 MPH
      var damage = Math.floor((magnitude / 88) * 10);
      this.takeDamage(damage, point, other); // 88 = 20 MPH
    }
  };

  Zombie.prototype.moveToward = function (position, speed) {
    var mosey = position.subtract(this.position).normalize().scale(speed || this.moseySpeed);
    this.velocity.set(mosey);
  };

  Zombie.prototype.states = {
    waiting: function (delta) {
      this.walking = false;
      this.velocity.scale(0);

      this.waitTimeout -= delta;
      if (this.waitTimeout < 0) {
        // reset wait period
        this.waitTimeout = MAX_WAIT_TIME * Math.random();
        this.currentState = this.states.wandering;
      }
    },
    wandering: function () {
      this.walking = true;

      // create a random target to shoot for
      if (this.target) {
        this.target.free();
      }
      var direction = Vector.create(Math.random() * 360);
      this.target = this.position.add(direction.scale(Math.random() * WANDER_DISTANCE));
      this.target.retain();

      this.currentState = this.states.searching;
    },
    searching: function () {
      this.walking = true;

      if (this.target) {
        var distance = this.target.subtract(this.position).magnitude();
        if (distance > 5) {
          this.moveToward(this.target);
        } else {
          // got to the target
          this.target.free();
          this.target = null;
          this.velocity.scale(0);
        }
      } else if (this.targetVel) {
        // move in the last direction seen for a bit
        this.target = this.targetVel.normalize().scale(300).translate(this.position);
        this.target.retain();
        this.targetVel = null;
      } else {
        this.currentState = this.states.waiting;
      }
    },
    avoiding: function () {
      this.walking = true;

      if (this.target) {
        var distance = this.target.subtract(this.position).magnitude();
        if (distance > 5) {
          var speed = (this.lastState == this.states.stalking) ? this.attackSpeed : this.moseySpeed;
          this.moveToward(this.target, speed);
        } else {
          // got to the target
          this.target       = this.lastTarget;
          this.lastTarget   = null;
          this.currentState = this.lastState || this.states.waiting;
          this.lastState    = null;
        }
      } else {
        this.currentState = this.states.waiting;
      }
    },
    stalking: function () {
      this.walking = true;

      if (!this.target) {
        this.currentState = this.states.searching;
        return;
      }

      var distance = this.target.subtract(this.position).magnitude();
      if (distance > 5) {
        this.moveToward(this.target, this.attackSpeed);
      } else {
        // got to the target
        this.target.free();
        this.target = null;
        this.currentState = this.states.searching;
      }

      if (this.targetSprite.inside) {
        this.currentState = this.states.pounding;
      }
    },
    pounding: function () {
      if (this.targetSprite.inside) {
        this.moveToward(this.targetSprite.inside.position, this.attackSpeed);
      } else {
        this.currentState = this.states.stalking;
      }
    },
    attacking: function (delta) {
      if (Game.dude.inside) {
        this.hit(Game.dude.inside);
      }
      this.velocity.scale(0);
      this.walking = false;
      this.elapsedAttackTime += delta;
    },
    thriller: function () {
      // TODO hehe yes
    }
  };

  Zombie.prototype.bulletHit = function (hit, damage, firearm) {
    var vec = hit.point.subtract(this.position);

    if (vec.y < -7 &&            // in the area of the head
        Math.abs(vec.x) === 10) { // only from the sides

      // HEADSHOT!
      // 5-10 times more damaging
      var scale = Math.round(5 + Math.random() * 5);
      this.takeDamage(damage * scale, hit.point, firearm);
      headshotBulletHit.fireSparks(hit);
    } else {
      this.takeDamage(damage, hit.point, firearm);
      bulletHit.fireSparks(hit);
    }
  };

  Zombie.prototype.takeDamage = function (damage, position, other) {
    if (this.health > 0) {
      // splat zombie blood at his feet
      var splatPos = this.position.clone().translate({x:0, y:4});
      BloodSplatter.splat(splatPos, 'green', damage);
      this.health -= damage;
      this.takingDamage = true;
      this.setFalseAfter('takingDamage', TAKING_DAMAGE_TIMEOUT);

      if (this.health <= 0) {
        // DEEEEEED
        this.velocity.scale(0);
        this.walkingFrameCounter = 0;
        this.collidable = false;
        this.shouldSave = false;
        this.z = 99; // always underfoot (starts between 100 and 200)
        // set the points for the now prone zombie
        this.points = [
          Vector.create(-15, 0, true),
          Vector.create( 15, 0, true),
          Vector.create( 15, 9, true),
          Vector.create(-15, 9, true)
        ];
        // reusing waitTimeout
        this.waitTimeout = 0;

        var reason = null;
        if (other) {
          var inhead = (damage > other.damage) ? 'in the head ' : '';
          if (other.isFirearm) {
            reason = 'shot ' + inhead + 'by a ' + other.description;
          } else if (other.clazz === 'BaseballBat') {
            reason = 'smashed ' + inhead + 'with a baseball bat';
          } else if (other.isCar) {
            reason = 'run over by a ';
            if (!other.driver) {
              reason += 'runaway ';
            }
            if (other.color) {
              reason += other.color + ' ';
            }
            reason += other.name;
          } else if (other.name === 'Barrel') {
            reason = 'run over by a barrel';
          } else if (other.name === 'Explosion') {
            if (other.originObject) {
              reason = 'blown away by an exploding ' + other.originObject.name;
            } else {
              reason = 'exploded';
            }
          }
        } else if (damage === 999) {
          reason = 'utterly destroyed by supernatural forces (cheater!)';
        }

        if (!reason) {
          reason = 'dispatched by unknown causes!';
        }

        Reporter.zombieDeath(reason);
      }
    }
  };

  Zombie.prototype.saveMetadata = function () {
    var metadata = SpriteModel.prototype.saveMetadata.call(this);
    metadata.health = this.health;
    return metadata;
  };

  Zombie.prototype.ATTACK_SPEED = ATTACK_SPEED;

  Collidable(Zombie);
  Timeout(Zombie);

  Game.events.subscribe('firearm discharged,explosion', function () {
    // wake up all the zombies
    _.each(Game.sprites, function (sprite) {
      if (sprite.isZombie) {
        sprite.setTarget(Game.dude);
      }
    });
  });

  return Zombie;
});
