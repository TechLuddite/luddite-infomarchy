.pragma library

// Which edge the desk keeps clear, and by how many pixels. `bar` is the
// scalar snapshot Omarchy injects (`position`, `barSize`, `barHidden`), not
// the Bar item itself. A missing snapshot keeps the historical top strip so
// an older shell still clears a top bar. The caller has to read those three
// fields in its own binding: this function is pure, and a bar moved after
// load only moves the desk if the binding runs again.

function whole(value) {
  var n = Number(value)
  if (!isFinite(n) || n <= 0) return 0
  return Math.round(n)
}

function insets(bar, fallbackTop) {
  var fallback = whole(fallbackTop)
  if (!bar) return { top: fallback, right: 0, bottom: 0, left: 0 }
  if (bar.barHidden === true) return { top: 0, right: 0, bottom: 0, left: 0 }
  var size = whole(bar.barSize)
  var position = String(bar.position || "top")
  if (position !== "top" && position !== "right" && position !== "bottom" && position !== "left")
    position = "top"
  return {
    top: position === "top" ? size : 0,
    right: position === "right" ? size : 0,
    bottom: position === "bottom" ? size : 0,
    left: position === "left" ? size : 0
  }
}
