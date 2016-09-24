define(['Game', 'SpriteModel'], function (Game, SpriteModel) {

  var MAX_LIFE = 2; // in seconds

  var Smoke = function () {
    this.init('Smoke');

    this.frame = Math.floor(Math.random() * 4);
    this.life  = 0;
    this.scale = 0.1;

    this.position.rot = 360 * Math.random();
    this.position.retain();

    this.velocity.set(360 * Math.random());
    this.velocity.scale(Math.random() * 5);
  };
  Smoke.prototype = new SpriteModel();
  Smoke.prototype.fx = true;

  Smoke.prototype.preMove = function (delta) {
    this.position.rot += 20   * delta;
    this.scale   += 0.35 * delta;
    this.opacity -= 0.3  * delta;
  };

  Smoke.prototype.postMove = function (delta) {
    this.life += delta;
    if (this.life > MAX_LIFE) {
      this.die();
    }
  };

  Smoke.createNew = function (position) {
    var smoke       = new Smoke();
    smoke.position.set(position);
    Game.addSprite(smoke);
  };

  return Smoke;
});
