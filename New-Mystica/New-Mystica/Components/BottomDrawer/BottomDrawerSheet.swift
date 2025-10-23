//
//  BottomDrawerSheet.swift
//  New-Mystica
//
//  Generic reusable bottom drawer component with SwiftUI sheet presentation
//

import SwiftUI
import SwiftData

// MARK: - Generic Bottom Drawer Sheet
struct BottomDrawerSheet<Content: View>: View {
    let title: String
    let isPresented: Binding<Bool>
    let onDismiss: (() -> Void)?
    @ViewBuilder let content: () -> Content

    @State private var dragOffset: CGFloat = 0
    @Environment(\.audioManager) private var audioManager

    init(
        title: String,
        isPresented: Binding<Bool>,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.isPresented = isPresented
        self.onDismiss = onDismiss
        self.content = content
    }

    var body: some View {
        VStack(spacing: 0) {
            // Drag indicator
            RoundedRectangle(cornerRadius: 2)
                .fill(Color.borderSubtle)
                .frame(width: 36, height: 4)
                .padding(.top, 8)
                .padding(.bottom, 16)

            // Header with title and close button
            HStack {
                TitleText(title, size: 20)

                Spacer()

                Button {
                    audioManager.playCancelClick()
                    dismissDrawer()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(Color.textSecondary)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle()
                                .fill(Color.backgroundSecondary)
                                .overlay(
                                    Circle()
                                        .stroke(Color.borderSubtle, lineWidth: 1)
                                )
                        )
                }
                .buttonStyle(PlainButtonStyle())
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 16)

            // Content
            content()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.backgroundPrimary)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.accent, lineWidth: 1)
                )
        )
        .offset(y: dragOffset)
        .gesture(
            DragGesture()
                .onChanged { value in
                    // Only allow dragging down
                    if value.translation.height > 0 {
                        dragOffset = value.translation.height
                    }
                }
                .onEnded { value in
                    // Dismiss if dragged down more than 100 points
                    if value.translation.height > 100 {
                        dismissDrawer()
                    } else {
                        // Snap back to original position
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            dragOffset = 0
                        }
                    }
                }
        )
        .onAppear {
            dragOffset = 0
        }
    }

    private func dismissDrawer() {
        onDismiss?()
        isPresented.wrappedValue = false
    }
}

// MARK: - Bottom Drawer Presentation Modifier
extension View {
    func bottomDrawer<Content: View>(
        title: String,
        isPresented: Binding<Bool>,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        self.sheet(isPresented: isPresented, onDismiss: onDismiss) {
            BottomDrawerSheet(
                title: title,
                isPresented: isPresented,
                onDismiss: onDismiss,
                content: content
            )
            .presentationDetents([.height(400), .large])
            .presentationDragIndicator(.hidden) // We have our own
            .presentationBackground(Color.clear)
        }
    }
}

#Preview {
    ZStack {
        Color.backgroundPrimary.ignoresSafeArea()

        VStack {
            TextButton("Show Bottom Drawer") {
                // Preview will show static drawer
            }
        }
    }
    .bottomDrawer(
        title: "Sample Drawer",
        isPresented: .constant(true)
    ) {
        VStack(spacing: 16) {
            NormalText("This is sample content inside the bottom drawer.")

            TextButton("Sample Action") {
                print("Action tapped")
            }
            .padding(.horizontal, 20)

            Spacer()
        }
        .padding(.top, 8)
    }
    .modelContainer(for: Item.self, inMemory: true)
    .environmentObject(NavigationManager())
    .environment(AppState.shared)
}