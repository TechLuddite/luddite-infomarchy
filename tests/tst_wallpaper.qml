import QtQuick
import QtTest
import ".."

TestCase {
  id: testCase
  name: "WallpaperAspectRatio"
  when: windowShown
  visible: true
  width: 800
  height: 400

  Component {
    id: wallpaperComponent
    WaveWallpaper {
      asynchronous: false
      playing: false
      clip: true
    }
  }

  Component {
    id: referenceComponent
    Image {
      x: 400
      fillMode: Image.PreserveAspectCrop
      asynchronous: false
      clip: true
    }
  }

  function test_preservesProportions_data() {
    var cases = []
    for (var format of ["png", "gif"]) {
      for (var size of [[344, 144], [160, 90], [90, 160]]) {
        cases.push({
          tag: format + "-" + size[0] + "x" + size[1],
          source: Qt.resolvedUrl("fixtures/wallpaper." + format),
          width: size[0], height: size[1]
        })
      }
    }
    return cases
  }

  function test_preservesProportions(data) {
    var wallpaper = createTemporaryObject(wallpaperComponent, testCase, {
      source: data.source, width: data.width, height: data.height
    })
    verify(wallpaper !== null)
    tryCompare(wallpaper, "status", Image.Ready)
    var reference = createTemporaryObject(referenceComponent, testCase, {
      source: data.source, width: data.width, height: data.height
    })
    verify(reference !== null)
    tryCompare(reference, "status", Image.Ready)
    checkImage(wallpaper, reference)

    // Moving the same wallpaper to an output with another shape must also
    // preserve its proportions. Exercise the live size bindings.
    wallpaper.width = data.height
    wallpaper.height = data.width
    tryCompare(wallpaper, "status", Image.Ready)
    reference.width = data.height
    reference.height = data.width
    checkImage(wallpaper, reference)
  }

  function checkImage(wallpaper, reference) {
    verify(waitForRendering(wallpaper))
    var actual = grabImage(wallpaper)
    var expected = grabImage(reference)
    // A blank/offscreen capture must not let two empty images pass.
    compare(expected.green(0, 0), 0)
    compare(expected.green(Math.floor(expected.width / 2), Math.floor(expected.height / 2)), 255)
    verify(actual.equals(expected), "wallpaper must match an aspect-preserving crop")
  }
}
