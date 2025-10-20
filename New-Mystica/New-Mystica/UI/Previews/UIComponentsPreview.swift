import SwiftUI

// MARK: - UI Components Preview
struct UIComponents_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Title Text Examples
                VStack(alignment: .leading, spacing: 8) {
                    TitleText("Mystica")
                    TitleText("Smaller Title", size: 24)
                }
                
                Divider()
                    .background(Color.mysticaLightBrown)
                
                // Normal Text Examples
                VStack(alignment: .leading, spacing: 8) {
                    NormalText("This is normal text content that can wrap to multiple lines")
                    NormalText("Smaller normal text", size: 15)
                }
                
                Divider()
                    .background(Color.mysticaLightBrown)
                
                // Small Text Examples
                VStack(alignment: .leading, spacing: 8) {
                    SmallText("This is small text for captions and secondary information")
                    SmallText("Even smaller text", size: 11)
                }
                
                Divider()
                    .background(Color.mysticaLightBrown)
                
                // Icon Button Examples
                VStack(spacing: 16) {
                    HStack(spacing: 16) {
                        IconButton(icon: "heart.fill") {
                            print("Heart tapped")
                        }
                        
                        IconButton(icon: "star.fill") {
                            print("Star tapped")
                        }
                        
                        IconButton(icon: "gear") {
                            print("Settings tapped")
                        }
                    }
                    
                    HStack(spacing: 16) {
                        IconButton(icon: "heart.fill", isDisabled: true) {
                            print("Disabled heart tapped")
                        }
                        
                        IconButton(icon: "star.fill", size: 56) {
                            print("Large star tapped")
                        }
                    }
                }
                
                Divider()
                    .background(Color.mysticaLightBrown)
                
                // Text Button Examples
                VStack(spacing: 16) {
                    TextButton("Primary Action") {
                        print("Primary button tapped")
                    }
                    
                    TextButton("Secondary Action", height: 40) {
                        print("Secondary button tapped")
                    }
                    
                    TextButton("Disabled Action", isDisabled: true) {
                        print("Disabled button tapped")
                    }
                }
                
                Divider()
                    .background(Color.mysticaLightBrown)
                
                // Back Button Examples
                HStack(spacing: 16) {
                    BackButton {
                        print("Back button tapped")
                    }
                    
                    BackButton(size: 32) {
                        print("Small back button tapped")
                    }
                    
                    BackButton(isDisabled: true) {
                        print("Disabled back button tapped")
                    }
                }
            }
            .padding()
        }
        .background(Color.mysticaDarkBrown)
        .previewDisplayName("UI Components Showcase")
    }
}
