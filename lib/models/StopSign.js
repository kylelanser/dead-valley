define(['SpriteModel', 'Collidable'], function (SpriteModel, Collidable) {

  var StopSign = function (type) {
    this.init(type || 'StopSign');
    this.mass    = Number.MAX_VALUE;
    this.inertia = Number.MAX_VALUE;
  };
  StopSign.prototype = new SpriteModel();
  StopSign.prototype.stationary = true;
  StopSign.prototype.description = 'Stop Sign';

  StopSign.prototype.spawned = function () {
    this.oldRot = this.position.rot;
    this.position.rot = 0;

    var r = this.oldRot / 90;
    if (r < 1) {
      this.tile = 0;
    } else if (r < 2) {
      this.tile = 2;
    } else if (r < 3) {
      this.tile = 1;
    } else {
      this.tile = 2;
      this.direction = true; // flip it
    }
  };

  StopSign.prototype.saveMetadata = function () {
    var metadata = SpriteModel.prototype.saveMetadata.call(this);
    metadata.position = this.position.clone();
    metadata.position.rot = this.oldRot;
    metadata.position.retain();
    return metadata;
  };

  Collidable(StopSign);

  return StopSign;
});
