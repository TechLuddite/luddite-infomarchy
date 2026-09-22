import QtQuick
import QtTest
import "../bar-insets.js" as BarInsets

// The desk's inset binding, minus the shell. Omarchy's bar snapshot is a
// QtObject whose position, barSize and barHidden change in place; assigning
// those properties here is the same notification the live binding sees when
// the bar is dragged to another edge after the plugin has loaded.
Item {
  id: root

  property bool haveBar: true
  property int fallback: 40

  QtObject {
    id: bar
    property string position: "top"
    property int barSize: 26
    property bool barHidden: false
  }

  readonly property var edge: BarInsets.insets(
    root.haveBar ? {
      position: bar.position,
      barSize: bar.barSize,
      barHidden: bar.barHidden
    } : null,
    root.fallback)

  TestCase {
    name: "BarInsets"
    when: windowShown

    function test_a_bar_moved_after_load_moves_the_inset() {
      compare(root.edge.top, 26)
      compare(root.edge.bottom, 0)
      bar.position = "bottom"
      bar.barSize = 32
      compare(root.edge.top, 0)
      compare(root.edge.bottom, 32)
      compare(root.edge.left, 0)
      compare(root.edge.right, 0)
      bar.position = "left"
      bar.barSize = 28
      compare(root.edge.left, 28)
      compare(root.edge.bottom, 0)
      bar.position = "right"
      compare(root.edge.right, 28)
      compare(root.edge.left, 0)
    }

    function test_hiding_the_bar_clears_the_inset() {
      bar.position = "bottom"
      bar.barSize = 26
      bar.barHidden = false
      compare(root.edge.bottom, 26)
      bar.barHidden = true
      compare(root.edge.top, 0)
      compare(root.edge.right, 0)
      compare(root.edge.bottom, 0)
      compare(root.edge.left, 0)
    }

    function test_no_bar_keeps_the_top_fallback() {
      root.haveBar = false
      root.fallback = 53
      compare(root.edge.top, 53)
      compare(root.edge.bottom, 0)
    }
  }
}
