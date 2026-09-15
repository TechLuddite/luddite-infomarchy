import QtQuick

// One image surface for still and animated wallpapers. Overlay playback
// pauses while it is closed; fillMode handles the display's aspect ratio.
Item {
  id: root

  property alias source: img.source
  property alias fillMode: img.fillMode
  property alias asynchronous: img.asynchronous
  property alias cache: img.cache
  property alias status: img.status
  property bool playing: true

  AnimatedImage {
    id: img
    anchors.fill: parent
    fillMode: Image.PreserveAspectCrop
    asynchronous: true
    cache: true
    playing: root.playing
    paused: !root.playing
    speed: 1.0
    // Keep the decoded frame's natural proportions. AnimatedImage stretches
    // frames to an explicit sourceSize before fillMode is applied, so using
    // the display dimensions here distorts wallpapers on mismatched outputs.
  }
}
