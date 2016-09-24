require(['Introduction', 'models/GasPump', 'models/Honda', 'inventory/GasCan', 'models/Hint'],
        function (Introduction, GasPump, Honda, GasCan, Hint) {

  var x = Game.map.originOffsetX + 450;
  var y = Game.map.originOffsetY + 300;

  Introduction.disableHints();

  var waitForTip = function (callback) {
    waitsFor(function () {
      return $('.tip').is(':visible');
    },
    "tip never showed up",
    1000);

    runs(function () {
      var tip = $('.tip');
      callback(tip);
    });
  };

  var loadCarSprite = function (x, y, callback) {
    var car;

    runs(function () {
      car = new Honda();
      car.position.x = x;
      car.position.y = y;
      Game.addSprite(car);
    });

    waitsFor(function () {
      return $('.sprite.car').is(':visible');
    },
    "car didn't appear",
    1000);

    runs(function () {
      var carSprite = $('.sprite.car');
      callback(carSprite, car);
    });
  };

  describe("gas pump", function() {

    var keyboard = require('Keyboard');

    var $container = $('#container');

    beforeEach(function () {
      $('.back').click();
      $('#resume').click();

      runs(function () {
        Game.dude.position.x = x - 20;
        Game.dude.position.y = y;

        clearSprites();
      });

      waitsFor(function () {
        // dude and arm
        return $('.sprite').length === 2;
      },
      "emtpy all sprites",
      1000);

      runs(function () {
        pump = new GasPump();
        pump.position.x = x;
        pump.position.y = y;
        Game.addSprite(pump);
      });

      waitsFor(function () {
        return $(".sprite[style*='objects']").is(":visible");
      },
      "pump needs to show up",
      1000);

      runs(function () {
        keyboard.keyStatus.right = true;
      });
    });

    afterEach(function () {
      runs(function () {
        keyboard.keyStatus.right = false;
        keyboard.keyStatus.left = true;
      });

      waitsFor(function () {
        return $('.tip').length === 0;
      });
      runs(function () {
        keyboard.keyStatus.left = false;
      });
    });

    describe("tooltip", function () {
      it("shows an Empty tooltip when empty", function () {
        pump.broken = false;
        pump.currentFuel = 0;

        waitForTip(function (tip) {
          expect(tip).toBeVisible();
          expect(tip).toHaveText("Empty");
        });
      });

      it("shows a Broken tooltip when broken", function () {
        pump.broken = true;
        pump.currentFuel = 1;

        waitForTip(function (tip) {
          expect(tip).toBeVisible();
          expect(tip).toHaveText("Broken");
        });
      });

      it("shows a Broken tooltip when broken even when empty", function () {
        pump.broken = true;
        pump.currentFuel = 0;

        waitForTip(function (tip) {
          expect(tip).toBeVisible();
          expect(tip).toHaveText("Broken");
        });
      });

      it("shows a Has Gas tooltip when has gas", function () {
        pump.broken = false;
        pump.currentFuel = 1;

        waitForTip(function (tip) {
          expect(tip).toBeVisible();
          expect(tip).toHaveText("Has Gas");
        });
      });

      it("removes the tip after walking away", function () {
        waitForTip(function (tip) {
          expect(tip).toBeVisible();

          // move away
          keyboard.keyStatus.left = true;

          waits(500);
          runs(function () {
            expect(tip).not.toBeVisible();
          });
        });
      });
    });

    describe("cursor", function () {
      it("changes the cursor class to a pump nozzle if the pump has gas and is not broken", function () {
        pump.broken = false;
        pump.currentFuel = 1;

        waits(100);
        runs(function () {
          expect($container).toHaveClass('pump');
        });
      });

      it("leaves the cursor alone if the pump is broken", function () {
        pump.broken = true;
        pump.currentFuel = 1;

        waits(100);
        runs(function () {
          expect($container).not.toHaveClass('pump');
        });
      });

      it("leaves the cursor alone if the pump doesn't have gas", function () {
        pump.broken = false;
        pump.currentFuel = 0;

        waits(100);
        runs(function () {
          expect($container).not.toHaveClass('pump');
        });
      });

      it("removes the cursor class after walking away", function () {
        pump.broken = false;
        pump.currentFuel = 1;

        waits(100);
        runs(function () {
          expect($container).toHaveClass('pump');

          // move away
          keyboard.keyStatus.left = true;

          waits(300);
          runs(function () {
            expect($container).not.toHaveClass('pump');
          });
        });
      });
    });

    describe("glow car", function () {
      it("lights up a car when hovering pump cursor if it's close enough", function () {
        pump.broken = false;
        pump.currentFuel = 1;

        waitForTip(function (tip) {

          loadCarSprite(x - 40, y, function (sprite) {
            sprite.trigger('mouseover');

            waits(100);
            runs(function () {
              expect(sprite).toHaveClass('glow');
            });
          });

        });
      });

      it("does not light up the car for broken pumps", function () {
        pump.broken = true;
        pump.currentFuel = 1;

        waitForTip(function (tip) {

          loadCarSprite(x - 40, y, function (sprite) {
            sprite.trigger('mouseover');

            waits(100);
            runs(function () {
              expect(sprite).not.toHaveClass('glow');
            });
          });
        });
      });

      it("does not light up the car for empty pumps", function () {
        pump.broken = false;
        pump.currentFuel = 0;

        waitForTip(function (tip) {
          loadCarSprite(x - 40, y, function (sprite) {
            sprite.trigger('mouseover');

            waits(100);
            runs(function () {
              expect(sprite).not.toHaveClass('glow');
            });
          });
        });
      });

      it("does not light up the car if it's too far away", function () {
        pump.broken = false;
        pump.currentFuel = 1;

        waitForTip(function (tip) {
          loadCarSprite(x - 60, y, function (sprite) {
            sprite.trigger('mouseover');

            waits(100);
            runs(function () {
              expect(sprite).not.toHaveClass('glow');
            });
          });
        });
      });
    });

    describe("fill er up", function () {
      beforeEach(function () {
        pump.broken = false;
        pump.currentFuel = 1;

        waits(100);
      });

      it("starts fueling the car when the mouse button is pressed", function () {
        waitForTip(function (tip) {
          loadCarSprite(x - 40, y, function (sprite, car) {

            sprite.trigger('mousedown');

            waits(100);

            runs(function () {
              expect(pump.fueling).not.toBeNull();
              expect(car.currentFuel).toBeGreaterThan(0);
              expect(pump.currentFuel).toBeLessThan(1);
            });
          });
        });
      });

      it("stops fueling the car when the mouse button is released", function () {
        waitForTip(function (tip) {
          loadCarSprite(x - 40, y, function (sprite, car) {

            sprite.trigger('mousedown');

            waits(100);

            runs(function () {
              var carFuel = car.currentFuel;
              var pumpFuel = pump.currentFuel;

              expect(pump.fueling).not.toBeNull();

              sprite.trigger('mouseup');

              nextFrame(function () {
                expect(pump.fueling).toBeNull();
                expect(car.currentFuel).toEqual(carFuel);
                expect(pump.currentFuel).toEqual(pumpFuel);
              });
            });
          });
        });
      });

      it("stops fueling the car when the pump runs out of gas", function () {
        pump.currentFuel = 0.1;

        waitForTip(function (tip) {
          loadCarSprite(x - 40, y, function (sprite, car) {

            sprite.trigger('mousedown');

            waitsFor(function () {
              return pump.currentFuel === 0;
            });

            runs(function () {
              expect(pump.fueling).toBeNull();
              expect(car.currentFuel).toBeCloseTo(0.1);
              expect(pump.currentFuel).toEqual(0);
            });
          });
        });
      });

      it("shows an Empty tooltip when the pump runs out of gas", function () {
        pump.currentFuel = 0.1;

        waitForTip(function (tip) {
          expect(tip).toBeVisible();
          expect(tip).toHaveText("Has Gas");

          loadCarSprite(x - 40, y, function (sprite, car) {
            sprite.trigger('mousedown');

            waitsFor(function () {
              return pump.currentFuel === 0;
            });

            runs(function () {
              expect(tip).toBeVisible();
              expect(tip).toHaveText("Empty");
            });
          });
        });
      });
    });

    describe("filling a gas can", function () {
      beforeEach(function () {
        pressKey('i');

        pump.broken = false;
        pump.currentFuel = 1;

        Game.dude.inventory.clear();

        gasCan = createItem('GasCan');
        Game.dude.inventory.stuffItemIn(gasCan);

        canNode = gasCan.displayNode().find('img');
      });

      it("starts fueling the gas can when the mouse button is pressed", function () {
        waitForTip(function () {
          canNode.trigger('mousedown');

          waits(100);

          runs(function () {
            expect(pump.fueling).not.toBeNull();
            expect(gasCan.currentFuel).toBeGreaterThan(0);
            expect(pump.currentFuel).toBeLessThan(1);
          });
        });
      });

      it("stops fueling the gas can when the mouse button is released", function () {
        waitForTip(function () {
          canNode.trigger('mousedown');

          waits(100);

          runs(function () {
            canFuel  = gasCan.currentFuel;
            pumpFuel = pump.currentFuel;

            expect(pump.fueling).not.toBeNull();

            canNode.trigger('mouseup');

            nextFrame(function () {
              expect(pump.fueling).toBeNull();
              expect(gasCan.currentFuel).toEqual(canFuel);
              expect(pump.currentFuel).toEqual(pumpFuel);
            });
          });
        });
      });

      it("stops fueling the gas can when the pump runs out of gas", function () {
        pump.currentFuel = 0.1;

        waitForTip(function () {
          canNode.trigger('mousedown');

          waitsFor(function () {
            return pump.currentFuel === 0;
          });

          runs(function () {
            expect(pump.fueling).toBeNull();
            expect(gasCan.currentFuel).toEqual(0.1);
            expect(pump.currentFuel).toEqual(0);
          });
        });
      });

      it("update the tooltip to 'Empty' when it runs out of gas", function () {
        pump.currentFuel = 0.1;

        waitForTip(function () {
          var tip = $('.tip:not(#skip-hints)');
          expect(tip).toBeVisible();
          expect(tip).toHaveText("Has Gas");

          canNode.trigger('mousedown');

          waitsFor(function () {
            return pump.currentFuel === 0;
          });

          runs(function () {
            expect(tip).toBeVisible();
            expect(tip).toHaveText("Empty");
          });
        });
      });
    });

  });

});
