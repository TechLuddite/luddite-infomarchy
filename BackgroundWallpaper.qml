import QtQuick
import qs.Ui

// Video-capable wallpaper surface, kept in its own file and reached through a
// Loader by URL. `BackgroundMedia` only exists on an Omarchy that has video
// wallpaper support; compiling it into Infomarchy.qml would take the whole
// plugin down on one that does not, while an unloaded file resolves nothing.
BackgroundMedia {
  // A wallpaper's sound track belongs to the built-in background plugin, which
  // decides which monitor plays it. The dashboard host stays silent.
  audioEnabled: false
}
