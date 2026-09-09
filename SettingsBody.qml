import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import qs.Commons

// Shared Web Mode / desk settings. Hosted by the overlay drawer and the bar panel.
ColumnLayout {
  id: root
  required property InfoSettings settings
  property var desk: null
  spacing: Style.spacing.md

  readonly property color fg: desk && desk.themeForeground ? desk.themeForeground : Color.foreground
  readonly property color dim: Qt.rgba(fg.r, fg.g, fg.b, 0.62)
  readonly property color faint: Qt.rgba(fg.r, fg.g, fg.b, 0.38)
  readonly property color green: desk && desk.green ? desk.green : Color.accent
  readonly property color yellow: desk && desk.yellow ? desk.yellow : Color.foreground
  readonly property color cyan: desk && desk.cyan ? desk.cyan : Color.accent
  readonly property color red: desk && desk.red ? desk.red : Color.urgent
  readonly property string mono: Style.resolvedFontFamily
  readonly property string webServerPath: settings.webServerPath
  property var tokens: []
  property var extraCidrs: []
  property var defaultCidrs: []
  property string selectedTokenId: ""
  property var qrRows: []
  property int qrSize: 0
  property string tokenLabelDraft: ""
  property string cidrDraft: ""
  property string statusText: ""

  function plain(value, max) {
    return String(value || "").replace(/[<>&]/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max || 64)
  }
  function copyValue(text) {
    if (desk && typeof desk.copyText === "function") return desk.copyText(text)
    var value = String(text || "")
    if (!value || value.length > 10000 || copyProc.running) return false
    copyProc.pendingText = value
    copyProc.running = true
    return true
  }
  function refreshMeta() {
    metaProc.running = false
    metaProc.running = true
  }
  function copySelectedUrl() {
    urlProc.pendingId = selectedTokenId
    urlProc.running = false
    urlProc.running = true
  }
  function refreshQr() {
    qrProc.running = false
    qrProc.running = true
  }
  function addToken() {
    addTokenProc.pending = tokenLabelDraft
    addTokenProc.running = false
    addTokenProc.running = true
  }
  function revokeSelected() {
    if (!selectedTokenId || tokens.length < 2) return
    revokeProc.pending = selectedTokenId
    revokeProc.running = false
    revokeProc.running = true
  }
  function addCidr() {
    addCidrProc.pending = cidrDraft
    addCidrProc.running = false
    addCidrProc.running = true
  }
  function dropCidr(text) {
    dropCidrProc.pending = text
    dropCidrProc.running = false
    dropCidrProc.running = true
  }

  Component.onCompleted: refreshMeta()
  Connections {
    target: root.settings
    function onWebEnabledChanged() { root.refreshMeta(); if (root.settings.webEnabled) root.refreshQr() }
  }

  Process {
    id: copyProc
    property string pendingText: ""
    command: ["bun", root.desk ? root.desk.copyTextPath : Qt.resolvedUrl("copy-text.ts").toString().replace(/^file:\/\//, "")]
    stdinEnabled: true
    onStarted: { write(JSON.stringify(pendingText) + "\n"); pendingText = "" }
  }
  Process {
    id: metaProc
    command: ["bun", root.webServerPath, "tokens"]
    stdout: SplitParser {
      splitMarker: "\n"
      onRead: function(line) {
        var raw = String(line || "")
        if (raw.length > 4096) return
        try {
          var parsed = JSON.parse(raw)
          if (!parsed || parsed.ok !== true) return
          root.tokens = Array.isArray(parsed.tokens) ? parsed.tokens.slice(0, 8) : []
          root.extraCidrs = Array.isArray(parsed.extraCidrs) ? parsed.extraCidrs.slice(0, 8) : []
          root.defaultCidrs = Array.isArray(parsed.defaults) ? parsed.defaults.slice(0, 8) : []
          if (!root.selectedTokenId && root.tokens.length) root.selectedTokenId = root.tokens[0].id
        } catch (e) {}
      }
    }
  }
  Process {
    id: urlProc
    property string pendingId: ""
    command: ["bun", root.webServerPath, "url", pendingId]
    stdout: SplitParser {
      splitMarker: "\n"
      onRead: function(line) {
        var raw = String(line || "")
        if (raw.length > 512) return
        try {
          var parsed = JSON.parse(raw)
          if (parsed && parsed.ok === true && typeof parsed.url === "string" && parsed.url.indexOf("http://") === 0)
            root.copyValue(parsed.url.slice(0, 256))
        } catch (e) {}
      }
    }
  }
  Process {
    id: qrProc
    command: ["bun", root.webServerPath, "qr", root.selectedTokenId]
    stdout: SplitParser {
      splitMarker: "\n"
      onRead: function(line) {
        var raw = String(line || "")
        if (raw.length > 8192) return
        try {
          var parsed = JSON.parse(raw)
          if (!parsed || parsed.ok !== true || !Array.isArray(parsed.rows)) { root.qrRows = []; root.qrSize = 0; return }
          root.qrRows = parsed.rows.slice(0, 80)
          root.qrSize = root.qrRows.length
        } catch (e) { root.qrRows = []; root.qrSize = 0 }
      }
    }
  }
  Process {
    id: addTokenProc
    property string pending: ""
    command: ["bun", root.webServerPath, "token-add", pending]
    onExited: { root.tokenLabelDraft = ""; root.refreshMeta() }
  }
  Process {
    id: revokeProc
    property string pending: ""
    command: ["bun", root.webServerPath, "token-revoke", pending]
    onExited: { root.selectedTokenId = ""; root.refreshMeta() }
  }
  Process {
    id: addCidrProc
    property string pending: ""
    command: ["bun", root.webServerPath, "cidr-add", pending]
    onExited: { root.cidrDraft = ""; root.refreshMeta() }
  }
  Process {
    id: dropCidrProc
    property string pending: ""
    command: ["bun", root.webServerPath, "cidr-remove", pending]
    onExited: root.refreshMeta()
  }

  Text { textFormat: Text.PlainText; text: "WEB MODE"; color: root.dim; font.family: root.mono; font.pixelSize: Style.font.caption; font.bold: true; font.letterSpacing: 1.4 }
  RowLayout {
    Layout.fillWidth: true
    spacing: Style.spacing.sm
    Rectangle {
      implicitWidth: webToggle.implicitWidth + Style.spacing.md * 2
      implicitHeight: webToggle.implicitHeight + Style.spacing.xs * 2
      radius: Style.cornerRadius
      color: Qt.rgba(root.fg.r, root.fg.g, root.fg.b, root.settings.webEnabled ? 0.16 : 0.06)
      border.color: Qt.rgba(root.fg.r, root.fg.g, root.fg.b, root.settings.webEnabled ? 0.55 : 0.18)
      border.width: 1
      Text { id: webToggle; anchors.centerIn: parent; textFormat: Text.PlainText; text: root.settings.webEnabled ? (root.settings.webUrl ? "WEB ON" : "WEB …") : "WEB OFF"; color: root.settings.webEnabled ? root.green : root.faint; font.family: root.mono; font.pixelSize: Style.font.caption; font.bold: true }
      MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.settings.toggleWebEnabled() }
    }
    Rectangle {
      visible: root.settings.webEnabled
      implicitWidth: copyUrl.implicitWidth + Style.spacing.md * 2
      implicitHeight: copyUrl.implicitHeight + Style.spacing.xs * 2
      radius: Style.cornerRadius
      color: Qt.rgba(root.cyan.r, root.cyan.g, root.cyan.b, 0.12)
      border.color: Qt.rgba(root.cyan.r, root.cyan.g, root.cyan.b, 0.45)
      border.width: 1
      Text { id: copyUrl; anchors.centerIn: parent; textFormat: Text.PlainText; text: "COPY URL"; color: root.cyan; font.family: root.mono; font.pixelSize: Style.font.caption; font.bold: true }
      MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.copySelectedUrl() }
    }
    Rectangle {
      visible: root.settings.webEnabled
      implicitWidth: showQr.implicitWidth + Style.spacing.md * 2
      implicitHeight: showQr.implicitHeight + Style.spacing.xs * 2
      radius: Style.cornerRadius
      color: Qt.rgba(root.cyan.r, root.cyan.g, root.cyan.b, 0.12)
      border.color: Qt.rgba(root.cyan.r, root.cyan.g, root.cyan.b, 0.45)
      border.width: 1
      Text { id: showQr; anchors.centerIn: parent; textFormat: Text.PlainText; text: "QR"; color: root.cyan; font.family: root.mono; font.pixelSize: Style.font.caption; font.bold: true }
      MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.refreshQr() }
    }
  }
  Text { textFormat: Text.PlainText; visible: !root.settings.webEnabled; wrapMode: Text.Wrap; Layout.fillWidth: true; text: "Turning Web Mode off stops the listener and keeps tokens. Revoke a token to rotate it."; color: root.faint; font.family: root.mono; font.pixelSize: Style.font.caption }

  Column {
    visible: root.qrSize > 0 && root.settings.webEnabled
    Layout.alignment: Qt.AlignHCenter
    Repeater {
      model: root.qrRows
      delegate: Row {
        id: qrRow
        required property string modelData
        Repeater {
          model: qrRow.modelData.length
          delegate: Rectangle {
            required property int index
            width: 5
            height: 5
            color: qrRow.modelData.charAt(index) === "1" ? "#111" : "#eee"
          }
        }
      }
    }
  }

  Text { textFormat: Text.PlainText; text: "TOKENS"; color: root.dim; font.family: root.mono; font.pixelSize: Style.font.caption; font.bold: true; font.letterSpacing: 1.4 }
  Repeater {
    model: root.tokens
    delegate: RowLayout {
      required property var modelData
      Layout.fillWidth: true
      spacing: Style.spacing.sm
      Text {
        textFormat: Text.PlainText
        text: (root.selectedTokenId === modelData.id ? "● " : "○ ") + root.plain(modelData.label, 32) + " · …" + root.plain(modelData.suffix, 4)
        color: root.selectedTokenId === modelData.id ? root.fg : root.dim
        font.family: root.mono
        font.pixelSize: Style.font.caption
        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: { root.selectedTokenId = modelData.id; if (root.settings.webEnabled) root.refreshQr() } }
      }
      Item { Layout.fillWidth: true }
      Text { textFormat: Text.PlainText; visible: root.tokens.length > 1; text: "REVOKE"; color: root.red; font.family: root.mono; font.pixelSize: Style.font.caption; MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: { root.selectedTokenId = modelData.id; root.revokeSelected() } } }
    }
  }
  RowLayout {
    Layout.fillWidth: true
    spacing: Style.spacing.sm
    Rectangle {
      Layout.fillWidth: true
      implicitHeight: 28
      radius: Style.cornerRadius
      color: Qt.rgba(root.fg.r, root.fg.g, root.fg.b, 0.06)
      border.color: Qt.rgba(root.fg.r, root.fg.g, root.fg.b, 0.18)
      border.width: 1
      TextInput {
        id: tokenInput
        anchors { fill: parent; leftMargin: 8; rightMargin: 8 }
        text: root.tokenLabelDraft
        color: root.fg
        font.family: root.mono
        font.pixelSize: Style.font.caption
        maximumLength: 32
        clip: true
        onTextChanged: root.tokenLabelDraft = text
        Text { textFormat: Text.PlainText; visible: !parent.text; text: "label"; color: root.faint; font: parent.font; anchors.verticalCenter: parent.verticalCenter }
      }
    }
    Rectangle {
      implicitWidth: addTok.implicitWidth + Style.spacing.md * 2
      implicitHeight: 28
      radius: Style.cornerRadius
      color: Qt.rgba(root.green.r, root.green.g, root.green.b, 0.12)
      border.color: Qt.rgba(root.green.r, root.green.g, root.green.b, 0.45)
      border.width: 1
      Text { id: addTok; anchors.centerIn: parent; textFormat: Text.PlainText; text: "ADD"; color: root.green; font.family: root.mono; font.pixelSize: Style.font.caption; font.bold: true }
      MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.addToken() }
    }
  }

  Text { textFormat: Text.PlainText; text: "ALLOW LIST"; color: root.dim; font.family: root.mono; font.pixelSize: Style.font.caption; font.bold: true; font.letterSpacing: 1.4 }
  Text { textFormat: Text.PlainText; wrapMode: Text.Wrap; Layout.fillWidth: true; text: "Default: " + root.defaultCidrs.join(", "); color: root.faint; font.family: root.mono; font.pixelSize: Style.font.caption }
  Repeater {
    model: root.extraCidrs
    delegate: RowLayout {
      required property string modelData
      Layout.fillWidth: true
      Text { textFormat: Text.PlainText; text: root.plain(modelData, 20); color: root.fg; font.family: root.mono; font.pixelSize: Style.font.caption }
      Item { Layout.fillWidth: true }
      Text { textFormat: Text.PlainText; text: "REMOVE"; color: root.red; font.family: root.mono; font.pixelSize: Style.font.caption; MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.dropCidr(modelData) } }
    }
  }
  RowLayout {
    Layout.fillWidth: true
    spacing: Style.spacing.sm
    Rectangle {
      Layout.fillWidth: true
      implicitHeight: 28
      radius: Style.cornerRadius
      color: Qt.rgba(root.fg.r, root.fg.g, root.fg.b, 0.06)
      border.color: Qt.rgba(root.fg.r, root.fg.g, root.fg.b, 0.18)
      border.width: 1
      TextInput {
        anchors { fill: parent; leftMargin: 8; rightMargin: 8 }
        text: root.cidrDraft
        color: root.fg
        font.family: root.mono
        font.pixelSize: Style.font.caption
        maximumLength: 18
        clip: true
        onTextChanged: root.cidrDraft = text
        Text { textFormat: Text.PlainText; visible: !parent.text; text: "10.0.0.0/24"; color: root.faint; font: parent.font; anchors.verticalCenter: parent.verticalCenter }
      }
    }
    Rectangle {
      implicitWidth: addCidr.implicitWidth + Style.spacing.md * 2
      implicitHeight: 28
      radius: Style.cornerRadius
      color: Qt.rgba(root.green.r, root.green.g, root.green.b, 0.12)
      border.color: Qt.rgba(root.green.r, root.green.g, root.green.b, 0.45)
      border.width: 1
      Text { id: addCidr; anchors.centerIn: parent; textFormat: Text.PlainText; text: "ADD"; color: root.green; font.family: root.mono; font.pixelSize: Style.font.caption; font.bold: true }
      MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.addCidr() }
    }
  }

  Text { textFormat: Text.PlainText; text: "SECTIONS · DESK / WEB"; color: root.dim; font.family: root.mono; font.pixelSize: Style.font.caption; font.bold: true; font.letterSpacing: 1.4 }
  Repeater {
    model: root.settings.definitions
    delegate: RowLayout {
      required property var modelData
      Layout.fillWidth: true
      spacing: Style.spacing.sm
      Text { textFormat: Text.PlainText; text: root.plain(modelData.label, 16); color: root.fg; font.family: root.mono; font.pixelSize: Style.font.caption; Layout.preferredWidth: 96 }
      Text {
        textFormat: Text.PlainText
        text: root.settings.sectionEnabled(modelData.id) ? "DESK ON" : "DESK OFF"
        color: root.settings.sectionEnabled(modelData.id) ? root.green : root.faint
        font.family: root.mono
        font.pixelSize: Style.font.caption
        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.settings.toggleSection(modelData.id) }
      }
      Text {
        textFormat: Text.PlainText
        text: modelData.id === "media" ? "WEB n/a" : (root.settings.webSectionEnabled(modelData.id) ? "WEB ON" : "WEB OFF")
        color: modelData.id === "media" ? root.faint : (root.settings.webSectionEnabled(modelData.id) ? root.cyan : root.faint)
        font.family: root.mono
        font.pixelSize: Style.font.caption
        MouseArea { anchors.fill: parent; enabled: modelData.id !== "media"; cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor; onClicked: root.settings.toggleWebSection(modelData.id) }
      }
    }
  }
}
