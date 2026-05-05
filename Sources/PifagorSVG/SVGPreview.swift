import SwiftUI
import WebKit
import PifagorSVGCore

struct SVGPreview: NSViewRepresentable {
    let svg: String
    let previewColor: Color

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
              color: \(previewColor.hexForHTML);
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              background-color: #eef1f3;
            }
            body::before {
              content: "";
              position: fixed;
              inset: 0;
              background:
                linear-gradient(45deg, #dfe4e7 25%, transparent 25%),
                linear-gradient(-45deg, #dfe4e7 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #dfe4e7 75%),
                linear-gradient(-45deg, transparent 75%, #dfe4e7 75%);
              background-size: 28px 28px;
              background-position: 0 0, 0 14px, 14px -14px, -14px 0;
              opacity: 0.42;
            }
            .stage {
              width: min(78vw, 180px);
              height: min(78vh, 180px);
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
