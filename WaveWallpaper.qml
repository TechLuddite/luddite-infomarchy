import QtQuick

// Wallpaper surface. A GIF or WebP plays as the file's own animation; anything
// else is a still and stays a still.
//
// This used to run a wave shader over the still. It was removed on 8 September
// 2026: the shader drew the same image a second time, and the desk dims this
// whole subtree to 0.32, at which point Qt blends each child on its own and the
// still ghosted through the wavy copy. Reinstating it needs one surface, not
// two, so the still is the shader's texture and never a sibling drawn beside it.
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
