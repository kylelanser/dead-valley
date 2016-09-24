define(['Game', 'Sprite', 'Vector', 'Sky'], function (Game, Sprite, Vector, Sky) {

  var context = Game.skyContext;
  var MAX_LIFE = 0.07; // in seconds

  var MuzzleFlash = function (position) {
    this.position     = Vector.create();
    this.position.rot = 0;
    this.position.retain();

    this.life    = 0;
    this.scale   = 0.1;
    this.position.set(position);
  };
  MuzzleFlash.prototype = new Sprite();
  MuzzleFlash.prototype.stationary = true;
  MuzzleFlash.prototype.fx         = true;

  MuzzleFlash.prototype.render = function (delta) {
    var position = this.position;
    var map = Game.map;
    context.save();
    context.translate(position.x - map.originOffsetX, position.y - map.originOffsetY);
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.arc(0, 0, this.scale, 0, Math.PI*2);
    context.fill();
    context.restore();
  };

  MuzzleFlash.prototype.preMove = function (delta) {
    this.scale += 400 * delta;
  };

  MuzzleFlash.prototype.postMove = function (delta) {
    this.life += delta;

    if (this.life > MAX_LIFE) {
      this.die();
    }
  };

  MuzzleFlash.prototype.z = 150;

  MuzzleFlash.createNew = function (position) {
    if (Sky.isDark()) {
      var flash = new MuzzleFlash(position);
      Game.sprites.push(flash);
    }
  };

  return MuzzleFlash;
});

