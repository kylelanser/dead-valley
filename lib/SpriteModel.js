// SpriteModel

define(["Game", "Console", "Matrix", "Vector", "EventMachine", "SpriteMarshal", "sprite-info"],
       function (Game, Console, Matrix, Vector, EventMachine, SpriteMarshal, spriteInfo) {

  var spriteID = 0;
  var bulletHit;

  Matrix  = new Matrix(2, 3);

  var SpriteModel = function () {
    this.visible  = true;
    this.reap     = false;

    this.collidable = false;

    this.currentNode = null;
    this.nextsprite  = null;
  };

  // this sprite should be saved when the level chunk in reclaimed
  SpriteModel.prototype.shouldSave = true;

  SpriteModel.prototype.init = function (name) {
    var i;
    // can init with an object, otherwise look it up
    var config = _.isObject(name) ? name : spriteInfo[name];

    this.config = config;

    if (!config) {
      Console.error("SpriteModel config for '"+name+"' does not exist!");
    }

    this.name  = config.name || name;
    this.clazz = _.isObject(name) ? this.name : name.replace(/\d+$/, ''); // numbers at the end denote types

    var co;
    if (config.collidableOffset) {
      co = config.collidableOffset;
    } else {
      // if not configured assume it's centered
      co = Vector.create(config.width / 2, config.height / 2);
    }
    this.points = [
      Vector.create(-co.x, -co.y, true),
      Vector.create( co.x, -co.y, true),
      Vector.create( co.x,  co.y, true),
      Vector.create(-co.x,  co.y, true)
    ];

    this.calculateNormals();

    // current points and normals that have been transformed by
    // the current position and rotation state
    this.transPoints  = [];
    this.transNormals = [];
    for (i = 0; i < this.points.length; i++) {
      this.transPoints[i] = this.points[i].clone();
      this.transPoints[i].retain();
      this.transNormals[i] = this.normals[i].clone();
      this.transNormals[i].retain();
    }
    this.clearCurrentPointsAndNormals(); // set dirty

    // assuming horizontal tiles
    this.tileWidth  = config.width;
    this.tileHeight = config.height;

    // default to normal size
    this.scale = 1;

    // cloned so we can manipulate it on a per-sprite instance basis
    this.center = $.extend({x:0, y:0}, config.center);

    this.position = Vector.create(0, 0, true);
    this.position.rot = 0;

    this.velocity = Vector.create(0, 0, true);
    this.velocity.rot = 0;

    this.acceleration = Vector.create(0, 0, true);
    this.acceleration.rot = 0;

    // where the sprite is on the grid
    this.gridCoords = Vector.create(0, 0, true);

    // sprites default to a z-index of 100
    this.z = config.z || 100;

    this.opacity = 1;

    this.inertia = 80;

    SpriteModel.newID(this);
  };

  SpriteModel.prototype.calculateNormals = function () {
    var p1, p2, n, i;

    this.normals = [];

    for (i = 1; i < this.points.length; i++) {
      p1 = this.points[i-1];
      p2 = this.points[i];

      n = p1.subtract(p2).normal().normalize();

      n.retain();

      this.normals.push(n);
    }

    p1 = this.points[this.points.length-1];
    p2 = this.points[0];

    n = p1.subtract(p2).normal().normalize();
    n.retain();

    this.normals.push(n);
  };
  
  SpriteModel.prototype.preMove  = function () {
  };

  SpriteModel.prototype.postMove = function () {
  };

  SpriteModel.prototype.clearCurrentPointsAndNormals = function () {
    this.transPoints.dirty  = true;
    this.transNormals.dirty = true;
  };

  // perform a speculativeMove -- lets see where he's going next frame
  SpriteModel.prototype.speculativeMove = function (delta) {
    if (!this.stationary) {
      // clear the cached calculated points and normals
      this.clearCurrentPointsAndNormals();

      // save current position
      this.oldPos     = this.position.clone();
      this.oldPos.rot = this.position.rot;
      this.oldPos.retain();

      // figure out where he's going to be at the current velocity
      this.position.x   += this.velocity.x   * delta;
      this.position.y   += this.velocity.y   * delta;
      this.position.rot += this.velocity.rot * delta;

      // update grid location with new position
      this.updateGrid();
    }
  };

  SpriteModel.prototype.restorePreSpeculativePosition = function () {
    // restore original position and rotation
    if (this.oldPos) {
      this.position.free();
      this.position = this.oldPos;
      this.oldPos = null;
    }
  };

  SpriteModel.prototype.integrate = function (delta) {
    this.velocity.x   += this.acceleration.x   * delta;
    this.velocity.y   += this.acceleration.y   * delta;
    this.velocity.rot += this.acceleration.rot * delta;
    this.position.x   += this.velocity.x   * delta;
    this.position.y   += this.velocity.y   * delta;
    this.position.rot += this.velocity.rot * delta;

    // zero is zero
    if (Math.abs(this.position.rot) < 1.0e-5) {
      this.position.rot = 0;
    }

    // cleanup
    this.clearCurrentPointsAndNormals();
    this.updateGrid();
    this.updateForVerticalZ();
  };

  SpriteModel.prototype.transformedNormals = function () {
    if (!this.transNormals.dirty) {
      return this.transNormals;
    }
    this.transNormals.dirty = false;
    var norms = this.transNormals;

    // only rotate
    Matrix.configure(this.position.rot, 1.0, 0, 0);

    var length = this.normals.length;
    for (var i = 0; i < length; i++) {
      Matrix.vectorMultiply(this.normals[i], norms[i]);
    }
    return norms;
  };

  var collideRangeWidth  = Game.GameWidth / 2;
  var collideRangeHeight = Game.GameHeight / 2;

  SpriteModel.prototype.inCollideRange = function () {
    x = this.position.x - Game.map.originOffsetX;
    y = this.position.y - Game.map.originOffsetY;

    return !(x + collideRangeWidth  < 0 ||
             y + collideRangeHeight < 0 ||
             x - collideRangeWidth  > Game.GameWidth ||
             y - collideRangeHeight > Game.GameHeight);
  };

  SpriteModel.prototype.updateCollideState = function () {
    this.collideRange = this.inCollideRange();
  };

  SpriteModel.prototype.updateGrid = function () {
    if (this.fx || this.reap) {
      return;
    }
    if (!this.currentNode) {
      this.gridCoords.set(0, 0);
    }

    var newNode = Game.map.updateWorldCoords(this.position, this.gridCoords);

    // we're off the the part of the world loaded into memory
    if (newNode === null) {
      this.die();
      return;
    }

    if (newNode) {
      if (this.currentNode) {
        this.currentNode.leave(this);
      }
      newNode.enter(this);
      this.currentNode = newNode;
      this.adjacentNodes = null; // clear current adjacent list
    }
  };

  SpriteModel.prototype.collision = function () {
  };

  SpriteModel.prototype.hide = function () {
    this.visible = false;
    this.onScreen = false;
  };

  SpriteModel.prototype.show = function () {
    this.visible = true;
  };

  SpriteModel.prototype.cleanupVectors = function () {
    if (this.velocity) {
      this.velocity.free();
    }
    if (this.acceleration) {
      this.acceleration.free();
    }
    if (this.points) {
      var length = this.points.length;
      for (var i; i < length; i++) {
	this.points[i].free();
	this.normals[i].free();
	this.transPoints[i].free();
	this.transNormals[i].free();
      }
    }
  };

  SpriteModel.prototype.die = function () {
    this.reap = true;
    if (this.currentNode) {
      this.currentNode.leave(this);
      this.currentNode = null;
    }
    this.cleanupVectors();
  };

  SpriteModel.prototype.transformedPoints = function () {
    if (!this.transPoints.dirty) {
      return this.transPoints;
    }
    this.transPoints.dirty = false;
    var trans = this.transPoints;
    Matrix.configure(this.position.rot, this.scale, this.position.x, this.position.y);
    var count = this.points.length;
    for (var i = 0; i < count; i++) {
      Matrix.vectorMultiply(this.points[i], trans[i]);
    }
    return trans;
  };

  SpriteModel.prototype.isClear = function (position) {
    position = position || this.position;
    var cn = this.currentNode;
    if (cn === null) {
      var gridx = Math.floor(position.x / Game.gridsize);
      var gridy = Math.floor(position.y / Game.gridsize);
      gridx = (gridx >= Game.map.grid.length) ? 0 : gridx;
      gridy = (gridy >= Game.map.grid[0].length) ? 0 : gridy;
      cn = Game.map.grid[gridx][gridy];
    }
    return (cn.isEmpty(this.collidesWith) &&
            cn.north.isEmpty(this.collidesWith) &&
            cn.south.isEmpty(this.collidesWith) &&
            cn.east.isEmpty(this.collidesWith) &&
            cn.west.isEmpty(this.collidesWith) &&
            cn.north.east.isEmpty(this.collidesWith) &&
            cn.north.west.isEmpty(this.collidesWith) &&
            cn.south.east.isEmpty(this.collidesWith) &&
            cn.south.west.isEmpty(this.collidesWith));
  };

  SpriteModel.prototype.nearby = function () {
    if (this.currentNode === null) return [];
    return _(this.currentNode.nearby()).without(this);
  };

  SpriteModel.prototype.distance = function (other) {
    return Math.sqrt(Math.pow(other.position.x - this.position.x, 2) + Math.pow(other.position.y - this.position.y, 2));
  };

  // take a relative Vector and make it a world Vector
  SpriteModel.prototype.relativeToWorld = function (relative) {
    Matrix.configure(this.position.rot, 1.0, 0, 0);
    return Matrix.vectorMultiply(relative);
  };

  // take a world Vector and make it a relative Vector
  SpriteModel.prototype.worldToRelative = function (world) {
    Matrix.configure(-this.position.rot, 1.0, 0, 0);
    return Matrix.vectorMultiply(world);
  };

  SpriteModel.prototype.saveMetadata = function () {
    this.position.round();
    return {
      clazz: this.clazz,
      type:  this.name,
      position:   this.position
    };
  };

  // set the z value based on the vertical position on the page
  SpriteModel.prototype.updateForVerticalZ = function () {
    // update anything between 100 and 200
    if (this.z >= 100 && this.z < 200) {
      var vert = (this.position.y - Game.map.originOffsetY) / Game.GameHeight;
      if (vert > 0 && vert < 1) {
        this.z = Math.round(vert * 100) + 100;
      }
    }
  };

  SpriteModel.prototype.bulletHit = function (hit, damage) {
    if (!bulletHit) {
      require(["fx/BulletHit"], function (BulletHit) {
        bulletHit = new BulletHit();
        bulletHit.fireSparks(hit);
      });
    } else {
      bulletHit.fireSparks(hit);
    }
  };

  // backwards compat
  SpriteModel.prototype.setColor = function (color) {
    this.color = color;
  };

  // called after spawned
  SpriteModel.prototype.spawned = function () {
  };

  SpriteMarshal(SpriteModel);
  EventMachine(SpriteModel);
  
  SpriteModel.newID = function (sprite) {
    sprite.id = spriteID++;
  };

  return SpriteModel;
});
