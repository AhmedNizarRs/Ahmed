# ScanForge: scan objects into STLs on your iPhone

ScanForge turns real objects into 3D-printable STL files on your iPhone. It uses Apple's Object Capture, the same guided LiDAR + photo scanning Apple's own Reality Composer uses, and builds the 3D model on the phone itself. You don't need a cloud service or a Mac to process scans.

Built for iPhone 17 Pro Max. It works on any iPhone Pro with LiDAR (12 Pro or newer) running iOS 17 or later.

## What it does

1. **Guided scanning.** Apple's capture overlay shows which sides still need photos. ScanForge adds plain instructions ("move closer", "slow down", "more light") and walks you through the recommended passes: around at object height, again from above, then flipped for the bottom.
2. **On-device reconstruction.** It turns the photos into a textured 3D model in a few minutes, with a progress ring and time estimate.
3. **Automatic STL.** As soon as the model is built, ScanForge makes a print-ready STL:
   - **Real size in millimetres.** LiDAR gives true scale.
   - **Z-up and sitting on the bed**, centred, so it drops straight into your slicer.
   - **Floating bits removed**, such as specks and bits of table the scan picked up.
   - **Welded mesh** with a watertight check, so you know before slicing whether it's a closed surface.
4. **Adjust before printing.**
   - Scale by percent, or **Fit to size**: type the real measured width, depth or height and the model scales to match.
   - Live dimensions in mm, plus a warning if the model is bigger than a 256 mm bed.
   - A 3D preview of the exact mesh that goes into the STL.
5. **Export.** It shares to AirDrop, Bambu Handy, Shapr3D, Files, and more. Every STL is also saved in **Files › On My iPhone › ScanForge**. You can view the textured model in AR at real size or share it as USDZ.

## Install it on your iPhone

### Option A: with a Mac (recommended)

1. Install **Xcode 26** (or newer) from the Mac App Store.
2. Open `scanforge/ScanForge.xcodeproj`.
3. Click the **ScanForge** target › **Signing & Capabilities** › pick your **Team**. A free Apple ID works; add it under Xcode › Settings › Accounts. If Xcode says the bundle ID is taken, change `com.ahmed.scanforge` to something unique.
4. Plug in your iPhone, choose it as the run destination, and press **Run** (⌘R).
5. On the iPhone, the first time only: **Settings › General › VPN & Device Management** › trust your developer certificate. Also turn on **Settings › Privacy & Security › Developer Mode** if asked.

With a free Apple ID, the app needs to be re-run from Xcode every 7 days. A paid developer account ($99/year) extends that to a year.

### Option B: without a Mac

Every push builds an unsigned `.ipa` on GitHub Actions (workflow **ScanForge iOS**). Download the `ScanForge-unsigned-ipa` artifact from the latest run, then install it with **Sideloadly** or **AltStore** from a Windows PC or Mac. They sign it with your Apple ID. The same 7-day rule applies to free Apple IDs.

## Getting good scans

- **Light:** bright and even. Daylight or several lamps, no harsh shadows.
- **Background:** a plain, non-shiny table with room to walk all the way around.
- **Movement:** slow and steady, with the object in the middle of the screen.
- **Passes:** do at least two heights. Flip the object for a third pass if you need the bottom.
- **Good objects:** matte and textured, from about mug size to shoe-box size.
- **Hard objects:** shiny, transparent, very thin, or plain white ones. A light coat of matte scanning spray, dry shampoo or chalk powder helps a lot.
- **Exact size:** measure the real object once with calipers and use **Fit to size**.

## Using the STL for designing prints

The STL is a reference body at real size. Common workflows:

- **Print a copy:** open it in Bambu Studio, PrusaSlicer, Cura or OrcaSlicer and slice. If the mesh check showed open edges, accept the slicer's "fix model" prompt.
- **Design a part that fits it** (holder, case, mount, replacement part): import the STL into Fusion, Onshape, Shapr3D, Blender or Tinkercad and model around it. For mating parts, add 0.2–0.5 mm clearance, since scans are accurate to about a millimetre, not a tenth.

## Project layout

```
scanforge/
├── ScanForge.xcodeproj
├── ScanForge/
│   ├── App/ScanForgeApp.swift          app entry + navigation
│   ├── Capture/ScanFlowModel.swift     capture → reconstruction → STL pipeline
│   ├── Capture/CaptureView.swift       guided camera screen
│   ├── Processing/ScanFlowView.swift   progress + error screens
│   ├── Library/                        scan list, storage, tips
│   ├── Detail/                         scan page, 3D preview, export
│   └── Export/
│       ├── PrintMesh.swift             mesh cleanup + binary STL writer (pure Swift)
│       └── PrintPreparer.swift         USDZ → print mesh (Model I/O)
└── Tests/main.swift                    STL pipeline tests
```

Run the mesh tests on a Mac:

```sh
cd scanforge
swiftc -O ScanForge/Export/PrintMesh.swift ScanForge/Export/PrintMesh+Base.swift ScanForge/Turntable/TurntableMath.swift Tests/main.swift -o /tmp/meshtests && /tmp/meshtests
```
