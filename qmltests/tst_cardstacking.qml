import QtQuick
import QtQuick.Layouts
import QtTest

// Reproduces the session card's stacking, because nothing else in this suite
// can. Every other QML check here matches source text or resolves names; none
// of them can tell whether a control inside a card is actually reachable by a
// pointer, and that is not a detail — a toggle that cannot be clicked is not a
// toggle. The real card is a ColumnLayout of content with the card's own
// focus/inspect MouseArea declared AFTER it, and declaration order is paint
// order, so the card's MouseArea sits on top of everything in the column and
// swallows its clicks. Text items do not accept mouse events, so lifting the
// column with z restores the inner controls without taking anything away from
// the card. `lift` flips that fix off so the bug itself stays proven.
Item {
  id: root
  width: 400; height: 200

  property string hit: ""
  property bool lift: true

  Rectangle {
    id: card
    anchors.fill: parent
    color: "#222"

    ColumnLayout {
      id: scol
      anchors.fill: parent
      z: root.lift ? 1 : 0
      // The real control is a name and a caret under one target, so the
      // fixture is too: a click on either glyph has to reach the same handler.
      Item {
        objectName: "providerToggle"
        implicitWidth: providerRow.implicitWidth
        implicitHeight: providerRow.implicitHeight
        Row {
          id: providerRow
          spacing: 4
          Text { objectName: "providerName"; text: "Grok Bot"; color: "white"; font.pixelSize: 16 }
          Text {
            objectName: "groupCaret"
            anchors.verticalCenter: parent.verticalCenter
            text: "\u25b4"
            color: "#888"
            font.pixelSize: 10
          }
        }
        MouseArea {
          objectName: "groupToggle"
          anchors { fill: parent; margins: -4 }
          onClicked: function(mouse) { root.hit = "provider"; mouse.accepted = true }
        }
      }
      Item { Layout.fillHeight: true }
    }

    MouseArea {
      objectName: "cardArea"
      anchors.fill: parent
      acceptedButtons: Qt.LeftButton | Qt.RightButton
      onClicked: root.hit = "card"
    }
  }

  TestCase {
    name: "sessionCardStacking"
    when: windowShown

    function clickOn(name) {
      var target = findChild(root, name)
      verify(target, "the fixture must expose " + name)
      verify(target.width > 0 && target.height > 0, name + " must have a real size")
      var point = target.mapToItem(root, target.width / 2, target.height / 2)
      mouseClick(root, point.x, point.y)
    }
    function clickToggle() { clickOn("groupToggle") }

    function test_an_inner_control_receives_its_own_click() {
      root.lift = true
      root.hit = ""
      clickToggle()
      compare(root.hit, "provider", "the provider name must take its own click")
    }

    function test_the_caret_is_part_of_the_same_target() {
      // The caret is the whole point of the affordance: pressing it must do
      // what pressing the name does, not fall through to the card.
      root.lift = true
      root.hit = ""
      clickOn("groupCaret")
      compare(root.hit, "provider", "the caret must share the name's target")
    }

    function test_the_name_is_part_of_the_same_target() {
      root.lift = true
      root.hit = ""
      clickOn("providerName")
      compare(root.hit, "provider", "the name must still take the click")
    }

    function test_the_card_still_takes_every_other_pixel() {
      root.lift = true
      root.hit = ""
      // Low in the card, where nothing in the column accepts events.
      mouseClick(root, root.width / 2, root.height - 20)
      compare(root.hit, "card", "lifting the column must not cost the card its own click")
    }

    function test_without_the_lift_the_card_swallows_it() {
      root.lift = false
      root.hit = ""
      clickToggle()
      compare(root.hit, "card", "this is the bug the z lift exists to fix")
    }
  }
}
