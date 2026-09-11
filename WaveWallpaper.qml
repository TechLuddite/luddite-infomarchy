import QtQuick

// One image surface for still and animated wallpapers. Overlay playback
// pauses while it is closed; image dimensions follow the display surface.
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
    sourceSize: Qt.size(Math.max(1, Math.round(root.width)), Math.max(1, Math.round(root.height)))
  }
}
