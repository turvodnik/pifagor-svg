import SwiftUI
import WebKit
import PifagorSVGCore

struct SVGPreviewColors {
    var current: Color
    var stroke: Color
    var fill: Color
    var background: Color

    static let defaults = SVGPreviewColors(
        current: .black,
        stroke: .black,
        fill: .black,
        background: Color(red: 0.98, green: 0.98, blue: 0.99)
    )
}

struct SVGPreview: NSViewRepresentable {
    let svg: String
    var colors: SVGPreviewColors = .defaults
    var showsCheckerboard = true
    var stageLimit: CGFloat = 140

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.setValue(false, forKey: "drawsBackground")
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        webView.loadHTMLString(html, baseURL: nil)
    }

    private var html: String {
        """
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            html, body {
              margin: 0;
              width: 100%;
              height: 100%;
              color: \(colors.current.hexForHTML);
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              background-color: \(colors.background.hexForHTML);
            }
            body::before {
              content: "";
              position: fixed;
              inset: 0;
              background: \(checkerBackground);
              background-size: 64px 64px;
              background-position: 0 0, 0 32px, 32px -32px, -32px 0;
              opacity: 0.075;
            }
            .stage {
              width: min(70vw, \(Int(stageLimit))px);
              height: min(70vh, \(Int(stageLimit))px);
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              z-index: 1;
            }
            svg {
              max-width: 100%;
              max-height: 100%;
              width: 100%;
              height: 100%;
            }
            svg[stroke]:not([stroke="none"]),
            svg [stroke]:not([stroke="none"]) {
              stroke: \(colors.stroke.hexForHTML) !important;
            }
            svg[fill]:not([fill="none"]),
            svg [fill]:not([fill="none"]) {
              fill: \(colors.fill.hexForHTML) !important;
            }
          </style>
        </head>
        <body>
          <div class="stage">\(safeSVGForPreview)</div>
        </body>
        </html>
        """
    }

    private var safeSVGForPreview: String {
        let trimmed = svg.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.hasPrefix("<svg") else {
            return "<span></span>"
        }

        let options = SVGOptimizationOptions(profile: .inline1em)
        guard let result = try? SVGOptimizer().optimize(trimmed, options: options) else {
            return "<span></span>"
        }

        return result.fullSVG
    }

    private var checkerBackground: String {
        guard showsCheckerboard else {
            return "none"
        }

        return """
        linear-gradient(45deg, #9aa4ad 25%, transparent 25%),
        linear-gradient(-45deg, #9aa4ad 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #9aa4ad 75%),
        linear-gradient(-45deg, transparent 75%, #9aa4ad 75%)
        """
    }
}

private extension Color {
    var hexForHTML: String {
        let nsColor = NSColor(self).usingColorSpace(.deviceRGB) ?? .black
        let red = Int((nsColor.redComponent * 255).rounded())
        let green = Int((nsColor.greenComponent * 255).rounded())
        let blue = Int((nsColor.blueComponent * 255).rounded())
        return String(format: "#%02X%02X%02X", red, green, blue)
    }
}
