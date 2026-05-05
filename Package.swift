// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "PifagorSVG",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(name: "PifagorSVGCore", targets: ["PifagorSVGCore"]),
        .executable(name: "PifagorSVGCoreTestRunner", targets: ["PifagorSVGCoreTestRunner"]),
        .executable(name: "pifagor-svg-cli", targets: ["PifagorSVGCLI"]),
        .executable(name: "PifagorSVG", targets: ["PifagorSVG"])
    ],
    targets: [
        .target(name: "PifagorSVGCore"),
        .executableTarget(
            name: "PifagorSVGCoreTestRunner",
            dependencies: ["PifagorSVGCore"]
        ),
        .executableTarget(
            name: "PifagorSVGCLI",
            dependencies: ["PifagorSVGCore"]
        ),
        .executableTarget(
            name: "PifagorSVG",
            dependencies: ["PifagorSVGCore"],
            resources: [.copy("Resources")]
        )
    ]
)
