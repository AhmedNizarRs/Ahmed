import Foundation
import ImageIO
import UIKit

struct Scan: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    var name: String
    let createdAt: Date
    var settings = PrintSettings()
    /// File name of the STL in the app's Documents folder (visible in the Files app).
    var stlFileName: String
    /// Settings used for the STL currently on disk, or nil if none was exported.
    var exportedSettings: PrintSettings?
    /// When the 3D model was last rebuilt from the photos.
    var processedAt: Date?
}

/// Keeps scans on disk.
///
/// Working data (photos, checkpoints, the textured model) lives in
/// Application Support/Scans/<id>/. Exported STLs go to Documents so they
/// show up in Files › On My iPhone › ScanForge.
@MainActor
final class ScanStore: ObservableObject {
    @Published private(set) var scans: [Scan] = []

    private let fileManager = FileManager.default
    private let scansRoot: URL
    private let exportsRoot: URL

    init() {
        let support = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        scansRoot = support.appendingPathComponent("Scans", isDirectory: true)
        exportsRoot = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        try? fileManager.createDirectory(at: scansRoot, withIntermediateDirectories: true)
        reload()
    }

    // MARK: Paths

    func folder(for scan: Scan) -> URL { scansRoot.appendingPathComponent(scan.id.uuidString, isDirectory: true) }
    func imagesURL(for scan: Scan) -> URL { folder(for: scan).appendingPathComponent("Images", isDirectory: true) }
    func checkpointURL(for scan: Scan) -> URL { folder(for: scan).appendingPathComponent("Checkpoint", isDirectory: true) }
    func modelURL(for scan: Scan) -> URL { folder(for: scan).appendingPathComponent("model.usdz") }
    func thumbnailURL(for scan: Scan) -> URL { folder(for: scan).appendingPathComponent("thumbnail.jpg") }
    func stlURL(for scan: Scan) -> URL { exportsRoot.appendingPathComponent(scan.stlFileName) }
    private func metadataURL(for scan: Scan) -> URL { folder(for: scan).appendingPathComponent("scan.json") }

    // MARK: Status

    func scan(id: UUID) -> Scan? { scans.first { $0.id == id } }
    func hasModel(_ scan: Scan) -> Bool { fileManager.fileExists(atPath: modelURL(for: scan).path) }
    func hasSTL(_ scan: Scan) -> Bool { fileManager.fileExists(atPath: stlURL(for: scan).path) }

    func photoCount(_ scan: Scan) -> Int {
        let files = (try? fileManager.contentsOfDirectory(at: imagesURL(for: scan), includingPropertiesForKeys: nil)) ?? []
        return files.filter { Self.imageExtensions.contains($0.pathExtension.lowercased()) }.count
    }

    /// Bytes used by the capture photos and reconstruction checkpoints.
    func photoStorageSize(_ scan: Scan) -> Int64 {
        directorySize(imagesURL(for: scan)) + directorySize(checkpointURL(for: scan))
    }

    func thumbnail(for scan: Scan) -> UIImage? {
        UIImage(contentsOfFile: thumbnailURL(for: scan).path)
    }

    // MARK: Changes

    func createScan() -> Scan {
        let number = (scans.compactMap { Int($0.name.replacingOccurrences(of: "Scan ", with: "")) }.max() ?? 0) + 1
        let name = "Scan \(number)"
        let scan = Scan(id: UUID(), name: name, createdAt: Date(), stlFileName: uniqueFileName(for: name, excluding: nil))
        try? fileManager.createDirectory(at: imagesURL(for: scan), withIntermediateDirectories: true)
        try? fileManager.createDirectory(at: checkpointURL(for: scan), withIntermediateDirectories: true)
        save(scan)
        return scan
    }

    func save(_ scan: Scan) {
        do {
            try fileManager.createDirectory(at: folder(for: scan), withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            try encoder.encode(scan).write(to: metadataURL(for: scan), options: .atomic)
        } catch {
            print("ScanForge: couldn't save scan metadata: \(error)")
        }
        if let index = scans.firstIndex(where: { $0.id == scan.id }) {
            scans[index] = scan
        } else {
            scans.insert(scan, at: 0)
        }
    }

    func rename(_ scan: Scan, to newName: String) {
        let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != scan.name else { return }
        var updated = scan
        updated.name = trimmed
        updated.stlFileName = uniqueFileName(for: trimmed, excluding: scan.id)
        if hasSTL(scan) {
            try? fileManager.moveItem(at: stlURL(for: scan), to: stlURL(for: updated))
        }
        save(updated)
    }

    func delete(_ scan: Scan) {
        try? fileManager.removeItem(at: folder(for: scan))
        try? fileManager.removeItem(at: stlURL(for: scan))
        scans.removeAll { $0.id == scan.id }
    }

    /// Frees space by removing capture photos. The model and STL stay.
    func deletePhotos(of scan: Scan) {
        try? fileManager.removeItem(at: imagesURL(for: scan))
        try? fileManager.removeItem(at: checkpointURL(for: scan))
        objectWillChange.send()
    }

    func markProcessed(_ scan: Scan) {
        var updated = self.scan(id: scan.id) ?? scan
        updated.processedAt = Date()
        updated.exportedSettings = nil
        save(updated)
    }

    func markExported(_ scan: Scan, settings: PrintSettings) {
        var updated = self.scan(id: scan.id) ?? scan
        updated.exportedSettings = settings
        save(updated)
    }

    /// Makes a small preview image from the first capture photo.
    func makeThumbnailIfNeeded(for scan: Scan) {
        let destination = thumbnailURL(for: scan)
        guard !fileManager.fileExists(atPath: destination.path) else { return }
        let photos = ((try? fileManager.contentsOfDirectory(at: imagesURL(for: scan), includingPropertiesForKeys: nil)) ?? [])
            .filter { Self.imageExtensions.contains($0.pathExtension.lowercased()) }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
        guard let photo = photos.first, let source = CGImageSourceCreateWithURL(photo as CFURL, nil) else { return }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 320,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return }
        try? UIImage(cgImage: image).jpegData(compressionQuality: 0.8)?.write(to: destination, options: .atomic)
        objectWillChange.send()
    }

    func reload() {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let folders = (try? fileManager.contentsOfDirectory(at: scansRoot, includingPropertiesForKeys: nil)) ?? []
        scans = folders
            .compactMap { folder in
                guard let data = try? Data(contentsOf: folder.appendingPathComponent("scan.json")) else { return nil }
                return try? decoder.decode(Scan.self, from: data)
            }
            .sorted { $0.createdAt > $1.createdAt }
    }

    // MARK: Helpers

    private static let imageExtensions: Set<String> = ["heic", "heif", "jpg", "jpeg", "png"]

    private func uniqueFileName(for name: String, excluding id: UUID?) -> String {
        let cleaned = name
            .components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>"))
            .joined(separator: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let base = cleaned.isEmpty ? "Scan" : cleaned
        let taken = Set(scans.filter { $0.id != id }.map { $0.stlFileName.lowercased() })
        var candidate = "\(base).stl"
        var counter = 2
        while taken.contains(candidate.lowercased()) {
            candidate = "\(base) \(counter).stl"
            counter += 1
        }
        return candidate
    }

    private func directorySize(_ url: URL) -> Int64 {
        guard let enumerator = fileManager.enumerator(at: url, includingPropertiesForKeys: [.fileSizeKey]) else { return 0 }
        var total: Int64 = 0
        for case let file as URL in enumerator {
            total += Int64((try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
        }
        return total
    }
}
