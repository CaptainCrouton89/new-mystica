//
//  LogViewerView.swift
//  New-Mystica
//
//  Debug log viewer for viewing and sharing network/app logs
//

import SwiftUI

struct LogViewerView: View {
    @State private var logContent: String = ""
    @State private var isRefreshing: Bool = false
    @State private var showShareSheet: Bool = false
    @State private var autoRefresh: Bool = false
    @State private var showClearConfirmation: Bool = false
    @Environment(\.dismiss) private var dismiss

    private let refreshTimer = Timer.publish(every: 2, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header with stats
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Log File Size")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(formatFileSize(FileLogger.shared.getLogFileSize()))
                            .font(.system(.body, design: .monospaced))
                            .fontWeight(.medium)
                    }

                    Spacer()

                    Toggle(isOn: $autoRefresh) {
                        Label("Auto-refresh", systemImage: "arrow.clockwise")
                            .font(.caption)
                    }
                    .toggleStyle(.button)
                    .tint(autoRefresh ? .blue : .gray)
                }
                .padding()
                .background(.ultraThinMaterial)

                Divider()

                // Log content
                ScrollView {
                    ScrollViewReader { proxy in
                        VStack(alignment: .leading, spacing: 0) {
                            if logContent.isEmpty {
                                Text("No logs available")
                                    .foregroundStyle(.secondary)
                                    .frame(maxWidth: .infinity, alignment: .center)
                                    .padding()
                            } else {
                                Text(logContent)
                                    .font(.system(size: 11, design: .monospaced))
                                    .textSelection(.enabled)
                                    .padding(8)
                                    .id("logBottom")
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .onChange(of: logContent) { _, _ in
                            // Auto-scroll to bottom when content updates
                            if autoRefresh {
                                withAnimation {
                                    proxy.scrollTo("logBottom", anchor: .bottom)
                                }
                            }
                        }
                    }
                }
                .background(Color(uiColor: .systemBackground))
            }
            .navigationTitle("Debug Logs")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 12) {
                        Button {
                            refreshLogs()
                        } label: {
                            Label("Refresh", systemImage: "arrow.clockwise")
                        }
                        .disabled(isRefreshing)

                        Button {
                            showClearConfirmation = true
                        } label: {
                            Label("Clear", systemImage: "trash")
                        }

                        Button {
                            showShareSheet = true
                        } label: {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                    }
                }
            }
            .onReceive(refreshTimer) { _ in
                if autoRefresh {
                    refreshLogs()
                }
            }
            .sheet(isPresented: $showShareSheet) {
                ShareSheet(activityItems: [FileLogger.shared.getLogFileURL()])
            }
            .alert("Clear Logs", isPresented: $showClearConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Clear All Logs", role: .destructive) {
                    clearLogs()
                }
            } message: {
                Text("This will permanently delete all logged data. This action cannot be undone.")
            }
            .task {
                refreshLogs()
            }
        }
    }

    private func refreshLogs() {
        isRefreshing = true
        logContent = FileLogger.shared.readLogs()
        isRefreshing = false
    }

    private func clearLogs() {
        FileLogger.shared.clearLogs()
        refreshLogs()
    }

    private func formatFileSize(_ bytes: Int64) -> String {
        ByteCountFormatter.string(fromByteCount: bytes, countStyle: .file)
    }
}

// MARK: - Share Sheet

struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(
            activityItems: activityItems,
            applicationActivities: nil
        )
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Preview

#Preview {
    LogViewerView()
}
