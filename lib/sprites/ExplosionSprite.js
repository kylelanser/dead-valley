define(['Sprite', 'Sky', 'Game'], function (Sprite, Sky, Game) {

  var context = Sky.context;

  var ExplosionSprite = function (model) {
    this.init(model);
  };
  ExplosionSprite.prototype = new Sprite();

  ExplosionSprite.prototype.draw = function (delta) {
    this.drawTile(this.model.frame);
    var model = this.model;
    var position = model.position;
    var map = Game.map;
    context.save();
    context.translate(position.x - map.originOffsetX, position.y - map.originOffsetY);
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.arc(0, 0, model.tileWidth * model.scale, 0, Math.PI*2);
    context.fill();
    context.restore();
    Sky.dirty = true;
  };

  return ExplosionSprite;
});
