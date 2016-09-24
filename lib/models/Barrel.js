// the ubiquitous barrel

define(["SpriteModel",
        "Collidable",
        "Reporter"],
       function (SpriteModel, Collidable, Reporter) {

  var uprightFriction = -4;
  var rollingFriction = -0.2;

  var Barrel = function () {
    this.init('Barrel');

    this.isRolling = false;

    this.mass    = 0.2;
    this.inertia = 10;

    // start at later barrelState so drawTile actually updates
    this.barrelState = 1;
  };
  Barrel.prototype = new SpriteModel();

  Barrel.prototype.preMove = function (delta) {
    var velocityMag = this.velocity.magnitude();

    if (velocityMag > 0) {
      var friction = (this.isRolling) ? rollingFriction : uprightFriction;

      this.velocity.translate(this.velocity.clone().scale(friction * delta));

      if (this.isRolling) {
        this.velocity.rot = 0;
        // follow the rolling direction
        this.position.rot = (this.velocity.angle() * 180 / Math.PI) - 90;

        this.barrelState = (this.barrelState + delta * this.velocity.magnitude()/10) % 3;
      } else {
        this.velocity.rot += this.velocity.rot * friction * delta;

        if (velocityMag > 10) {
          this.setRolling(true);
          Reporter.barrelRolled();
        }
      }
    }
  };

  Barrel.prototype.setRolling = function (val) {
    if (val) {
      this.updateForRolling();
    }
    this.isRolling = val;
  };

  Barrel.prototype.updateForRolling = function () {
    // update the rendering info
    // TODO stuff these into the sprite-info thingy
    this.width         = 22;
    this.tileWidth     = 22;
    this.center.x      = 11;
  };

  Barrel.prototype.saveMetadata = function () {
    var metadata = SpriteModel.prototype.saveMetadata.call(this);
    metadata.setRolling = this.isRolling;
    return metadata;
  };

  Collidable(Barrel);

  return Barrel;
});
