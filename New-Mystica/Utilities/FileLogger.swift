import Foundation
import OSLog

/// Comprehensive file-based logger for debugging network requests, responses, and app events
class FileLogger {
    static let shared = FileLogger()

    private let fileURL: URL
    private let queue = DispatchQueue(label: "com.mystica.filelogger", qos: .utility)
    private let maxFileSize: Int = 10_000_000 // 10MB

    private let logger = Logger(subsystem: "com.mystica.app", category: "FileLogger")

    init() {
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        fileURL = documentsPath.appendingPathComponent("mystica_debug.log")

        // Create file if it doesn't exist
        if !FileManager.default.fileExists(atPath: fileURL.path) {
            FileManager.default.createFile(atPath: fileURL.path, contents: nil)
        }

        // Log session start
        logSessionStart()
    }

    // MARK: - Public Logging Methods

    /// Log a general message
    func log(_ message: String, level: LogLevel = .info) {
        writeLog(message: message, level: level)
    }

    /// Log network request details
    func logRequest(_ request: URLRequest, body: Data? = nil) {
        var logMessage = """

        ╔══════════════════════════════════════════════════════════════
        ║ 📤 REQUEST
        ╠══════════════════════════════════════════════════════════════
        ║ URL: \(request.url?.absoluteString ?? "nil")
        ║ Method: \(request.httpMethod ?? "nil")
        ║ Headers:
        """

        if let headers = request.allHTTPHeaderFields {
            for (key, value) in headers {
                // Redact sensitive headers
                let displayValue = key.lowercased().contains("auth") || key.lowercased().contains("key")
                    ? "[REDACTED]" : value
                logMessage += "\n║   \(key): \(displayValue)"
            }
        }

        if let body = body ?? request.httpBody,
           let bodyString = String(data: body, encoding: .utf8) {
            logMessage += "\n║ Body:\n║ \(bodyString.replacingOccurrences(of: "\n", with: "\n║ "))"
        }

        logMessage += "\n╚══════════════════════════════════════════════════════════════"

        writeLog(message: logMessage, level: .info)
    }

    /// Log network response details
    func logResponse(_ response: HTTPURLResponse?, data: Data?, error: Error? = nil) {
        var logMessage = """

        ╔══════════════════════════════════════════════════════════════
        ║ 📥 RESPONSE
        ╠══════════════════════════════════════════════════════════════
        """

        if let response = response {
            logMessage += """

            ║ Status: \(response.statusCode)
            ║ URL: \(response.url?.absoluteString ?? "nil")
            ║ Headers:
            """
            for (key, value) in response.allHeaderFields {
                logMessage += "\n║   \(key): \(value)"
            }
        }

        if let error = error {
            logMessage += "\n║ ❌ ERROR: \(error.localizedDescription)"
            logMessage += "\n║ Error Details: \(error)"
        }

        if let data = data {
            logMessage += "\n║ Size: \(ByteCountFormatter.string(fromByteCount: Int64(data.count), countStyle: .file))"

            // Try to parse as JSON for pretty printing
            if let jsonObject = try? JSONSerialization.jsonObject(with: data),
               let prettyData = try? JSONSerialization.data(withJSONObject: jsonObject, options: .prettyPrinted),
               let prettyString = String(data: prettyData, encoding: .utf8) {
                logMessage += "\n║ Body:\n║ \(prettyString.replacingOccurrences(of: "\n", with: "\n║ "))"
            } else if let bodyString = String(data: data, encoding: .utf8) {
                logMessage += "\n║ Body:\n║ \(bodyString.replacingOccurrences(of: "\n", with: "\n║ "))"
            } else {
                logMessage += "\n║ Body: [Binary data]"
            }
        }

        logMessage += "\n╚══════════════════════════════════════════════════════════════"

        let level: LogLevel = error != nil ? .error : .info
        writeLog(message: logMessage, level: level)
    }

    /// Log an error with context
    func logError(_ error: Error, context: String = "") {
        let message = """

        ❌ ERROR\(context.isEmpty ? "" : " [\(context)]")
        \(error.localizedDescription)
        \(error)
        """
        writeLog(message: message, level: .error)
    }

    /// Log an encodable payload (like request/response models)
    func logPayload<T: Encodable>(_ payload: T, label: String = "Payload") {
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            let jsonData = try encoder.encode(payload)
            if let jsonString = String(data: jsonData, encoding: .utf8) {
                let message = """

                📦 \(label):
                \(jsonString)
                """
                writeLog(message: message, level: .debug)
            }
        } catch {
            writeLog(message: "Failed to encode \(label): \(error)", level: .error)
        }
    }

    // MARK: - File Management

    /// Get the log file URL for sharing
    func getLogFileURL() -> URL {
        return fileURL
    }

    /// Read all logs as a string
    func readLogs() -> String {
        return (try? String(contentsOf: fileURL, encoding: .utf8)) ?? "No logs available"
    }

    /// Clear all logs
    func clearLogs() {
        queue.async { [weak self] in
            guard let self = self else { return }
            try? "".write(to: self.fileURL, atomically: true, encoding: .utf8)
            self.logSessionStart()
        }
    }

    /// Get file size
    func getLogFileSize() -> Int64 {
        guard let attributes = try? FileManager.default.attributesOfItem(atPath: fileURL.path),
              let fileSize = attributes[.size] as? Int64 else {
            return 0
        }
        return fileSize
    }

    // MARK: - Private Methods

    private func writeLog(message: String, level: LogLevel) {
        queue.async { [weak self] in
            guard let self = self else { return }

            // Check file size and rotate if needed
            if self.getLogFileSize() > self.maxFileSize {
                self.rotateLogs()
            }

            let timestamp = ISO8601DateFormatter().string(from: Date())
            let logEntry = "[\(timestamp)] [\(level.emoji) \(level.rawValue)] \(message)\n"

            // Also log to OSLog for Console.app access
            self.logger.log(level: level.osLogType, "\(message)")

            // Write to file
            if let data = logEntry.data(using: .utf8),
               let fileHandle = try? FileHandle(forWritingTo: self.fileURL) {
                defer { fileHandle.closeFile() }
                fileHandle.seekToEndOfFile()
                fileHandle.write(data)
            }
        }
    }

    private func rotateLogs() {
        // Keep last log as .old, start fresh
        let oldLogURL = fileURL.deletingPathExtension().appendingPathExtension("old.log")
        try? FileManager.default.removeItem(at: oldLogURL)
        try? FileManager.default.moveItem(at: fileURL, to: oldLogURL)
        FileManager.default.createFile(atPath: fileURL.path, contents: nil)

        logger.info("Log file rotated due to size limit")
    }

    private func logSessionStart() {
        let message = """

        ════════════════════════════════════════════════════════════════
        🚀 NEW SESSION STARTED
        ════════════════════════════════════════════════════════════════
        Device: \(UIDevice.current.model)
        OS: \(UIDevice.current.systemName) \(UIDevice.current.systemVersion)
        App Version: \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown")
        ════════════════════════════════════════════════════════════════
        """
        writeLog(message: message, level: .info)
    }
}

// MARK: - Supporting Types

enum LogLevel: String {
    case debug = "DEBUG"
    case info = "INFO"
    case warning = "WARNING"
    case error = "ERROR"

    var emoji: String {
        switch self {
        case .debug: return "🔍"
        case .info: return "ℹ️"
        case .warning: return "⚠️"
        case .error: return "❌"
        }
    }

    var osLogType: OSLogType {
        switch self {
        case .debug: return .debug
        case .info: return .info
        case .warning: return .default
        case .error: return .error
        }
    }
}
