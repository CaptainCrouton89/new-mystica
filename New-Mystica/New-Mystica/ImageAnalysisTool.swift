//
//  ImageAnalysisTool.swift
//  New-Mystica
//
//  Created by AI Assistant on 1/25/25.
//

import Foundation
import UIKit
import SpriteKit

/**
 * ImageAnalysisTool - Advanced image analysis for transparency debugging
 * 
 * ESSENTIAL FUNCTIONALITY:
 * - Analyze alpha channel properties of images
 * - Check texture creation and filtering modes
 * - Generate diagnostic reports for transparency issues
 * - Create test images with known transparency properties
 * 
 * USAGE: ImageAnalysisTool.analyzeImage(named: "SkeletonSprite")
 */
struct ImageAnalysisTool {
    
    /**
     * Comprehensive analysis of an image's transparency properties
     */
    static func analyzeImage(named imageName: String) -> ImageAnalysisReport {
        var report = ImageAnalysisReport(imageName: imageName)
        
        guard let image = UIImage(named: imageName) else {
            report.error = "Failed to load image: \(imageName)"
            return report
        }
        
        report.basicInfo = analyzeBasicImageInfo(image)
        report.alphaChannelInfo = analyzeAlphaChannel(image)
        report.textureInfo = analyzeTextureCreation(image)
        report.transparencyIssues = detectTransparencyIssues(image)
        
        return report
    }
    
    /**
     * Analyze basic image properties
     */
    private static func analyzeBasicImageInfo(_ image: UIImage) -> BasicImageInfo {
        var info = BasicImageInfo()
        
        info.size = image.size
        info.scale = image.scale
        info.orientation = image.imageOrientation
        
        if let cgImage = image.cgImage {
            info.hasCGImage = true
            info.bitsPerComponent = cgImage.bitsPerComponent
            info.bitsPerPixel = cgImage.bitsPerPixel
            info.bytesPerRow = cgImage.bytesPerRow
            info.colorSpace = cgImage.colorSpace?.name as String?
        }
        
        return info
    }
    
    /**
     * Analyze alpha channel properties
     */
    private static func analyzeAlphaChannel(_ image: UIImage) -> AlphaChannelInfo {
        var info = AlphaChannelInfo()
        
        guard let cgImage = image.cgImage else {
            info.error = "No CGImage available"
            return info
        }
        
        info.alphaInfo = cgImage.alphaInfo
        info.hasAlpha = cgImage.alphaInfo != .none && cgImage.alphaInfo != .noneSkipFirst && cgImage.alphaInfo != .noneSkipLast
        
        // Check if alpha is premultiplied
        switch cgImage.alphaInfo {
        case .premultipliedFirst, .premultipliedLast:
            info.isPremultiplied = true
        case .first, .last, .alphaOnly:
            info.isPremultiplied = false
        default:
            info.isPremultiplied = nil
        }
        
        // Sample alpha values from corners and center
        info.alphaSamples = sampleAlphaValues(cgImage)
        
        return info
    }
    
    /**
     * Analyze texture creation properties
     */
    private static func analyzeTextureCreation(_ image: UIImage) -> TextureInfo {
        var info = TextureInfo()
        
        // Test different texture creation methods
        let texture1 = SKTexture(image: image)
        texture1.filteringMode = .nearest
        info.nearestFiltering = TextureDetails(
            size: texture1.size(),
            filteringMode: texture1.filteringMode
        )
        
        let texture2 = SKTexture(image: image)
        texture2.filteringMode = .linear
        info.linearFiltering = TextureDetails(
            size: texture2.size(),
            filteringMode: texture2.filteringMode
        )
        
        if let cgImage = image.cgImage {
            let texture3 = SKTexture(cgImage: cgImage)
            texture3.filteringMode = .nearest
            info.cgImageTexture = TextureDetails(
                size: texture3.size(),
                filteringMode: texture3.filteringMode
            )
        }
        
        return info
    }
    
    /**
     * Detect potential transparency issues
     */
    private static func detectTransparencyIssues(_ image: UIImage) -> [TransparencyIssue] {
        var issues: [TransparencyIssue] = []
        
        guard let cgImage = image.cgImage else {
            issues.append(TransparencyIssue(
                type: .noCGImage,
                severity: .critical,
                description: "Image has no CGImage representation"
            ))
            return issues
        }
        
        // Check alpha channel
        switch cgImage.alphaInfo {
        case .none, .noneSkipFirst, .noneSkipLast:
            issues.append(TransparencyIssue(
                type: .noAlphaChannel,
                severity: .critical,
                description: "Image has no alpha channel - transparency will not work"
            ))
        case .premultipliedFirst, .premultipliedLast:
            issues.append(TransparencyIssue(
                type: .premultipliedAlpha,
                severity: .warning,
                description: "Image has premultiplied alpha - may cause blending issues"
            ))
        default:
            break
        }
        
        // Check color space
        if let colorSpace = cgImage.colorSpace {
            if (colorSpace.name as String?) == "kCGColorSpaceGenericRGB" {
                issues.append(TransparencyIssue(
                    type: .genericColorSpace,
                    severity: .info,
                    description: "Using generic RGB color space - consider sRGB for better compatibility"
                ))
            }
        }
        
        // Check bit depth
        if cgImage.bitsPerPixel < 32 {
            issues.append(TransparencyIssue(
                type: .lowBitDepth,
                severity: .warning,
                description: "Low bit depth (\(cgImage.bitsPerPixel) bits) - may affect transparency quality"
            ))
        }
        
        return issues
    }
    
    /**
     * Sample alpha values from specific points in the image
     */
    private static func sampleAlphaValues(_ cgImage: CGImage) -> [AlphaSample] {
        var samples: [AlphaSample] = []
        
        let width = cgImage.width
        let height = cgImage.height
        
        // Sample points: corners and center
        let samplePoints = [
            CGPoint(x: 0, y: 0),                    // Top-left
            CGPoint(x: width-1, y: 0),               // Top-right
            CGPoint(x: 0, y: height-1),             // Bottom-left
            CGPoint(x: width-1, y: height-1),       // Bottom-right
            CGPoint(x: width/2, y: height/2)        // Center
        ]
        
        for point in samplePoints {
            if let alphaValue = getAlphaValue(at: point, in: cgImage) {
                samples.append(AlphaSample(
                    point: point,
                    alphaValue: alphaValue,
                    description: "Alpha at (\(Int(point.x)), \(Int(point.y)))"
                ))
            }
        }
        
        return samples
    }
    
    /**
     * Get alpha value at a specific point in the image
     */
    private static func getAlphaValue(at point: CGPoint, in cgImage: CGImage) -> CGFloat? {
        let x = Int(point.x)
        let y = Int(point.y)
        
        guard x >= 0 && x < cgImage.width && y >= 0 && y < cgImage.height else {
            return nil
        }
        
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bytesPerPixel = 4
        let bytesPerRow = bytesPerPixel
        let bitsPerComponent = 8
        
        var pixelData = [UInt8](repeating: 0, count: bytesPerPixel)
        
        guard let context = CGContext(
            data: &pixelData,
            width: 1,
            height: 1,
            bitsPerComponent: bitsPerComponent,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return nil
        }
        
        context.draw(cgImage, in: CGRect(x: -x, y: -y, width: cgImage.width, height: cgImage.height))
        
        // Alpha is the last component in premultiplied format
        let alpha = CGFloat(pixelData[3]) / 255.0
        return alpha
    }
    
    /**
     * Create a test image with known transparency properties
     */
    static func createTestImage(size: CGSize = CGSize(width: 100, height: 100)) -> UIImage? {
        let renderer = UIGraphicsImageRenderer(size: size)
        
        return renderer.image { context in
            // Clear the entire image
            context.cgContext.clear(CGRect(origin: .zero, size: size))
            
            // Draw shapes with different alpha values
            let rect = CGRect(origin: .zero, size: size)
            
            // Background circle (fully opaque)
            context.cgContext.setFillColor(UIColor.red.cgColor)
            context.cgContext.fillEllipse(in: rect.insetBy(dx: 10, dy: 10))
            
            // Middle circle (50% alpha)
            context.cgContext.setFillColor(UIColor.blue.withAlphaComponent(0.5).cgColor)
            context.cgContext.fillEllipse(in: rect.insetBy(dx: 25, dy: 25))
            
            // Inner circle (25% alpha)
            context.cgContext.setFillColor(UIColor.green.withAlphaComponent(0.25).cgColor)
            context.cgContext.fillEllipse(in: rect.insetBy(dx: 40, dy: 40))
            
            // Corner squares with different alphas
            let cornerSize = CGSize(width: 15, height: 15)
            
            // Top-left: 100% alpha
            context.cgContext.setFillColor(UIColor.yellow.cgColor)
            context.cgContext.fill(CGRect(origin: CGPoint(x: 5, y: 5), size: cornerSize))
            
            // Top-right: 75% alpha
            context.cgContext.setFillColor(UIColor.orange.withAlphaComponent(0.75).cgColor)
            context.cgContext.fill(CGRect(origin: CGPoint(x: size.width - 20, y: 5), size: cornerSize))
            
            // Bottom-left: 50% alpha
            context.cgContext.setFillColor(UIColor.purple.withAlphaComponent(0.5).cgColor)
            context.cgContext.fill(CGRect(origin: CGPoint(x: 5, y: size.height - 20), size: cornerSize))
            
            // Bottom-right: 25% alpha
            context.cgContext.setFillColor(UIColor.cyan.withAlphaComponent(0.25).cgColor)
            context.cgContext.fill(CGRect(origin: CGPoint(x: size.width - 20, y: size.height - 20), size: cornerSize))
        }
    }
}

// MARK: - Data Models

struct ImageAnalysisReport {
    let imageName: String
    var error: String?
    var basicInfo: BasicImageInfo?
    var alphaChannelInfo: AlphaChannelInfo?
    var textureInfo: TextureInfo?
    var transparencyIssues: [TransparencyIssue] = []
    
    var hasIssues: Bool {
        return !transparencyIssues.isEmpty
    }
    
    var criticalIssues: [TransparencyIssue] {
        return transparencyIssues.filter { $0.severity == .critical }
    }
    
    var warnings: [TransparencyIssue] {
        return transparencyIssues.filter { $0.severity == .warning }
    }
}

struct BasicImageInfo {
    var size: CGSize = .zero
    var scale: CGFloat = 1.0
    var orientation: UIImage.Orientation = .up
    var hasCGImage: Bool = false
    var bitsPerComponent: Int = 0
    var bitsPerPixel: Int = 0
    var bytesPerRow: Int = 0
    var colorSpace: String?
}

struct AlphaChannelInfo {
    var alphaInfo: CGImageAlphaInfo = .none
    var hasAlpha: Bool = false
    var isPremultiplied: Bool?
    var alphaSamples: [AlphaSample] = []
    var error: String?
}

struct TextureInfo {
    var nearestFiltering: TextureDetails?
    var linearFiltering: TextureDetails?
    var cgImageTexture: TextureDetails?
}

struct TextureDetails {
    let size: CGSize
    let filteringMode: SKTextureFilteringMode
}

struct AlphaSample {
    let point: CGPoint
    let alphaValue: CGFloat
    let description: String
}

struct TransparencyIssue {
    enum IssueType {
        case noCGImage
        case noAlphaChannel
        case premultipliedAlpha
        case genericColorSpace
        case lowBitDepth
        case unknown
    }
    
    enum Severity {
        case info
        case warning
        case critical
    }
    
    let type: IssueType
    let severity: Severity
    let description: String
}

// MARK: - Extensions for Debugging

extension ImageAnalysisReport {
    func generateReport() -> String {
        var report = "🔍 Image Analysis Report for: \(imageName)\n"
        report += "=" * 50 + "\n\n"
        
        if let error = error {
            report += "❌ ERROR: \(error)\n\n"
            return report
        }
        
        // Basic Info
        if let basicInfo = basicInfo {
            report += "📊 Basic Information:\n"
            report += "  Size: \(basicInfo.size)\n"
            report += "  Scale: \(basicInfo.scale)\n"
            report += "  Orientation: \(basicInfo.orientation.rawValue)\n"
            report += "  Has CGImage: \(basicInfo.hasCGImage)\n"
            if basicInfo.hasCGImage {
                report += "  Bits per component: \(basicInfo.bitsPerComponent)\n"
                report += "  Bits per pixel: \(basicInfo.bitsPerPixel)\n"
                report += "  Bytes per row: \(basicInfo.bytesPerRow)\n"
                report += "  Color space: \(basicInfo.colorSpace ?? "Unknown")\n"
            }
            report += "\n"
        }
        
        // Alpha Channel Info
        if let alphaInfo = alphaChannelInfo {
            report += "🎨 Alpha Channel Information:\n"
            report += "  Alpha info: \(alphaInfo.alphaInfo.rawValue)\n"
            report += "  Has alpha: \(alphaInfo.hasAlpha)\n"
            if let isPremultiplied = alphaInfo.isPremultiplied {
                report += "  Premultiplied: \(isPremultiplied)\n"
            }
            
            if !alphaInfo.alphaSamples.isEmpty {
                report += "  Alpha samples:\n"
                for sample in alphaInfo.alphaSamples {
                    report += "    \(sample.description): \(String(format: "%.3f", sample.alphaValue))\n"
                }
            }
            report += "\n"
        }
        
        // Texture Info
        if let textureInfo = textureInfo {
            report += "🎬 Texture Information:\n"
            if let nearest = textureInfo.nearestFiltering {
                report += "  Nearest filtering: \(nearest.size) (mode: \(nearest.filteringMode.rawValue))\n"
            }
            if let linear = textureInfo.linearFiltering {
                report += "  Linear filtering: \(linear.size) (mode: \(linear.filteringMode.rawValue))\n"
            }
            if let cgImage = textureInfo.cgImageTexture {
                report += "  CGImage texture: \(cgImage.size) (mode: \(cgImage.filteringMode.rawValue))\n"
            }
            report += "\n"
        }
        
        // Issues
        if !transparencyIssues.isEmpty {
            report += "⚠️ Transparency Issues:\n"
            for issue in transparencyIssues {
                let icon = issue.severity == .critical ? "❌" : issue.severity == .warning ? "⚠️" : "ℹ️"
                report += "  \(icon) \(issue.description)\n"
            }
            report += "\n"
        }
        
        // Summary
        report += "📋 Summary:\n"
        report += "  Has issues: \(hasIssues)\n"
        report += "  Critical issues: \(criticalIssues.count)\n"
        report += "  Warnings: \(warnings.count)\n"
        
        return report
    }
}

// Helper for string repetition
extension String {
    static func * (left: String, right: Int) -> String {
        return String(repeating: left, count: right)
    }
}
