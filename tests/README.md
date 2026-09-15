# Wallpaper rendering regression

Run `bun test wallpaper-render.test.ts`. It uses Qt 6's `qmltestrunner`
(from `qt6-declarative` on Omarchy), an offscreen window, and software rendering.
It does not connect to or modify the desktop.

The test compares `WaveWallpaper` with a plain `Image.PreserveAspectCrop` at
ultrawide, landscape, and portrait sizes, then resizes each live instance.
The PNG and two-frame GIF fixtures contain a centered 50×50 white square on
a 160×90 black canvas; the GIF's second frame also has a red corner marker.
These synthetic fixtures contain no external artwork.

Regenerate the fixtures with ImageMagick:

```sh
magick -size 160x90 xc:black -fill white -draw 'rectangle 55,20 104,69' tests/fixtures/wallpaper.png
magick -delay 20 tests/fixtures/wallpaper.png \( -size 160x90 xc:black -fill white -draw 'rectangle 55,20 104,69' -fill red -draw 'rectangle 0,0 9,9' \) -loop 0 tests/fixtures/wallpaper.gif
```
