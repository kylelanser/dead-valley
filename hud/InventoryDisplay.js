// Inventory Display
define(['game', 'Inventory'], function (game, Inventory) {

  var draggingItem, draggingItemOriginalPos, draggingItemOriginalInv,
      currentDraggable, currentDraggableOffset;

  // magic numbers!
  // a single block is 44x44 but some extra crap is put in there
  var cellSize = 50;
  var itemOffset = {
    top:  3,
    left: 3
  };

  // dropping anywhere else reverts the drag
  $('body').droppable().bind('drop' ,function () {
    draggingItemOriginalInv.addItem(draggingItem,
                                    draggingItemOriginalPos.x,
                                    draggingItemOriginalPos.y);
    draggingItem = null;
    draggingItemOriginalPos = null;
    draggingItemOriginalInv = null;
  }).mousemove(function (e) {
    if (currentDraggable) {
      currentDraggable.css({
        left: e.pageX - currentDraggableOffset.left,
        top:  e.pageY - currentDraggableOffset.top
      });
    }
  }).click(function (e) {
    // if we currently have a draggable we need to pass clicks through
    if (currentDraggable) {
      currentDraggable.hide();

      // find the inteded target
      var target = $(document.elementFromPoint(e.pageX, e.pageY)).parents('.inventory');

      // re-show helper
      currentDraggable.show();

      // pass the click on to the intended target
      if (target.length) {
        target.trigger(e);
      }
    }
  });
 
  var clearCurrentDraggable = function () {
    if (currentDraggable) {
      currentDraggable.remove();
      currentDraggable = currentDraggableOffset = null;
    }
  };

  /** The InventoryDisplay Object **/

  var InventoryDisplay = function (inventory, parent, config) {
    this.inventory = inventory;
    this.parent    = parent;
    this.config    = config || {};

    this.createTable();

    this.renderAll();
    this.setupEventHandlers();
  };

  InventoryDisplay.prototype = {

    itemEventHandlers: {
      dragstart: function (event, ui) {
        var draggable = $(event.target);
        var item = draggable.data('item');
        this.dragStart(item);
      },
      click: function (event) {
        if (!currentDraggable) {
          var target = $(event.target).parentsUntil('td').andSelf().filter('.inventory-item');
          var pos = target.offset();
          this.clickDragStart(
            target.data('item'),
            {left:event.pageX - pos.left, top:event.pageY - pos.top}
          );
        }
        // so the table click handler doesn't fire
        event.stopPropagation();
      }
    },

    tableEventHandlers: {
      drop: function (e, ui) {
        var item;
        var tablePos = $(this.table).offset();
        var posX = Math.round((ui.offset.left - tablePos.left) / cellSize);
        var posY = Math.round((ui.offset.top - tablePos.top) / cellSize);

        // clear current draggable if we have one
        clearCurrentDraggable();

        if (this.inventory.isAvailable(draggingItem, posX, posY)) {
          // successful drag!

          // add the item to the inventory
          this.inventory.addItem(draggingItem, posX, posY);

          // remove the draggingItem data
          draggingItem = null;
          draggingItemOriginalPos = null;
          draggingItemOriginalInv = null;

        } else {

          // are we on top of a thing
          item = this.inventory.singleItemOverlay(draggingItem, posX, posY);
          if (item) {
            // TODO check if the item accepts what we're dropping
            // swap em

            // save off the draggingItem, clickDragStart overwrites it
            var newItem = draggingItem;

            // figure out the offset -- center it
            var offset = {
              left: (cellSize/2) * item.width,
              top:  (cellSize/2) * item.height
            };
            // start dragging the dropped on thing
            this.clickDragStart(item, offset);

            // add the dropped item to the inventory
            this.inventory.addItem(newItem, posX, posY);
          } else {
            // figure out the offset -- center it
            var offset = currentDraggableOffset || {
              left: (cellSize/2) * draggingItem.width,
              top:  (cellSize/2) * draggingItem.height
            };
            // restart dragging the dropped thing
            this.clickDragStart(draggingItem, offset);
          }
        }
        // stop the drop event from bubbling to the body
        e.stopPropagation();
      },

      click: function (e) {
        // if we're click dragging something drop it on this table
        if (currentDraggable) {
          this.tableEventHandlers.drop.call(this, e, { offset: currentDraggable.offset() });
        }
      }
    },

    setupEventHandlers: function () {
      this.itemAddedEventHandler   = $.proxy(this.renderItem, this);
      this.itemRemovedEventHandler = $.proxy(this.removeItem, this);

      this.inventory.subscribe('itemAdded', this.itemAddedEventHandler);
      this.inventory.subscribe('itemRemoved', this.itemRemovedEventHandler);

      var self = this;
      _.each(this.tableEventHandlers, function (handler, key) {
        self.table.bind(key, $.proxy(handler, self));
      });
    },

    setupItemEventHandlers: function (itemNode) {
      var self = this;
      _.each(this.itemEventHandlers, function (handler, key) {
        itemNode.bind(key, $.proxy(handler, self));
      });
    },

    clearEventHandlers: function () {
      this.inventory.unsubscribe('itemAdded', this.itemAddedEventHandler);
      this.inventory.unsubscribe('itemRemoved', this.itemRemovedEventHandler);
    },

    // create the table markup
    createTable: function () {
      var i, j, row, td;
      var rowCount = this.inventory.height;
      var colCount = this.inventory.width;
      var table = $("<table/>").addClass("inventory");
      table.attr('id', this.config.id);
      for (i = 0; i < rowCount; i++) {
        row = $("<tr/>");
        for (j = 0; j < colCount; j++) {
          td = $("<td/>");
          row.append(td);
        }
        table.append(row);
      }

      table.droppable({
        greedy:    true,
        tolerance: 'touch'
      });
      this.parent.append(table);
      this.table = table;
    },

    // render an item at a place
    renderItem: function (item) {
      var i, j;
      var x = item.x;
      var y = item.y;
      var start = this.table.find("tr:eq("+y+") td:eq("+x+")");
      var pos = start.position();
      var displayNode = item.displayNode();
      displayNode.css({left:pos.left + itemOffset.left, top:pos.top + itemOffset.top});
      displayNode.addClass('inventory-item');
      displayNode.draggable({
        helper:      'clone',
        appendTo:    'body',
        containment: 'body',
        scroll:      false
      });
      displayNode.data('item', item);
      this.setupItemEventHandlers(displayNode);
      start.append(displayNode);
      for (i = 0; i < item.width; i++) {
        for (j = 0; j < item.height; j++) {
          this.table.find("tr:eq("+(y+j)+") td:eq("+(x+i)+")").addClass('occupied');
        }
      }
    },

    // remove the item from its place
    removeItem: function (item) {
      var x = item.x;
      var y = item.y;
      var start = this.table.find("tr:eq("+y+") td:eq("+x+")");
      start.empty();
      for (i = 0; i < item.width; i++) {
        for (j = 0; j < item.height; j++) {
          this.table.find("tr:eq("+(y+j)+") td:eq("+(x+i)+")").removeClass('occupied');
        }
      }
    },

    // render all the items in the associated Inventory
    renderAll: function () {
      _.each(this.inventory.items, function (item) {
        this.renderItem(item);
      }, this);
    },

    // this is run when we start the drag
    dragStart: function (item) {
      draggingItem = item;
      // remember the original position in case we need to abort
      draggingItemOriginalPos = {
        x: draggingItem.x,
        y: draggingItem.y
      };
      // also remember which inventory we came from
      draggingItemOriginalInv = this.inventory;
      // finally remove the draggable item from the inventory
      this.inventory.removeItem(draggingItem);
    },

    // this is run when we start the drag on a click
    clickDragStart: function (item, offset) {
      // create a 'helper' object to follow the mouse around
      currentDraggable = item.displayNode().clone();
      currentDraggable.addClass('inventory-item click-dragging');
      // keep track of the offset so we render the dragging correctly
      currentDraggableOffset = offset;

      // finish the start of the drag as a draggable
      this.dragStart(item);

      $('body').append(currentDraggable);
    },

    toggle: function () {
      if (this.table.css('visibility') === 'hidden') {
        this.show();
      } else {
        this.hide();
      }
    },

    show: function () {
      this.table.css('visibility', 'visible');
    },

    hide: function () {
      this.table.css('visibility', 'hidden');
    },

    visible: function () {
      return this.table.css('visibility') === 'visible';
    }
  };

  return InventoryDisplay;
});
