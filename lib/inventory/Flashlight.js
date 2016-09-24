// Flashlight
// Everybody's got a little light under the sun

define(['inventory/InventoryItem', 'Light', 'Sky', 'Vector'], function (InventoryItem, Light, Sky, Vector) {

  var maxLength = 120;

  var renderLight = Light({
    halfWidth: 30,
    lampHW:     3,
    offset:    Vector.create(0, -10, true)
  });

  var Flashlight = function () {
  };

  Flashlight.prototype.render = function (dude) {
    var position = dude.position;
    var length = 0;
    if (Sky.isDark() && dude.aimDirection) {
      var vector = dude.aimPoint.subtract(dude.position);
      length = Math.min(vector.magnitude(), maxLength);
      renderLight(position, dude.aimDirection + Math.PI/2, length);
    }
  };

  InventoryItem(Flashlight, {
    width:       1, 
    height:      3, 
    image:       'flashlight',
    clazz:       'Flashlight',
    description: "Flashlight",
    dropScale:    0.2,
    dropRotate:   true
  });

  Flashlight.prototype.aimable = true;

  return Flashlight;
});
