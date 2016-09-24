// Rigid Body
// for physics simulation

define(["SpriteModel", "Vector"], function (SpriteModel, Vector) {

  var RigidBody = function () {};
  RigidBody.prototype = new SpriteModel();

  RigidBody.prototype.isRigidBody = true;

  RigidBody.prototype.init = function (name) {
    SpriteModel.prototype.init.call(this, name);
    this.forces = Vector.create(0, 0, true);
    this.mass = 1;
    this.torque = 0;
  };

  // override SpriteModel's integrate function
  RigidBody.prototype.integrate = function (delta) {
    // linear
    // acceleration, velocity and position are in pixels
    // there are 10 pixels to a meter
    this.acceleration.x = 10 * this.forces.x / this.mass;
    this.acceleration.y = 10 * this.forces.y / this.mass;
    this.velocity.x += this.acceleration.x * delta;
    this.velocity.y += this.acceleration.y * delta;
    this.position.x += this.velocity.x * delta;
    this.position.y += this.velocity.y * delta;

    this.forces.x = this.forces.y = 0; // clear forces

    // angular
    this.acceleration.rot = this.torque / this.inertia;
    this.velocity.rot += this.acceleration.rot * delta;
    this.position.rot += this.velocity.rot * delta;

    this.torque = 0; // clear torque

    this.position.rot = Math.round(this.position.rot);

    this.clearCurrentPointsAndNormals();
    this.updateGrid();
  };

  RigidBody.prototype.addForce = function (vector, offset) {
    this.forces.translate(vector);
    this.torque += offset.crossProduct(vector);
  };

  return RigidBody;
});

