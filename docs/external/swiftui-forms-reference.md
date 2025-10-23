# SwiftUI Forms LLM Reference

## Form Container Signatures

```swift
// Basic form with sections
Form {
    Section("Header") {
        // Content
    } footer: {
        Text("Footer")
    }
}

// Form with submit scope blocking
Group {
    TextField("text1", text: $text1)
        .onSubmit { print("text1 commit") }
    TextField("text2", text: $text2)
        .onSubmit { print("text2 commit") }
}
.submitScope() // Blocks onSubmit propagation to parent
.onSubmit { print("group commit") }
```

## Input Control Signatures

### TextField
```swift
// Basic binding
TextField("Placeholder", text: $binding)

// With prompt (iOS 15+)
TextField("Username", text: $username, prompt: Text("Enter username"))

// With axis for multiline (iOS 16+)
TextField("Description", text: $description, axis: .vertical)
    .lineLimit(3...6)

// With text suggestions (iOS 18+)
TextField("Message", text: $message)
    .textInputSuggestions(suggestions)
    .textInputCompletion { suggestion in
        message = suggestion
    }

// Full signature with callbacks (deprecated iOS 15+)
TextField("Label", text: $binding, onEditingChanged: { editing in
    // Called when focus changes
}, onCommit: {
    // Called on return/submit
})
```

### SecureField
```swift
// Basic secure input
SecureField("Password", text: $password)

// With prompt
SecureField("Password", text: $password, prompt: Text("Required"))

// CRITICAL: Always use .textContentType for passwords
SecureField("Password", text: $password)
    .textContentType(.password)
```

### TextEditor
```swift
// Multiline text editing
TextEditor(text: $longText)
    .frame(height: 200)

// GOTCHA: TextEditor doesn't support placeholder text directly
// Use ZStack overlay for placeholder behavior
```

## Picker, Toggle, Stepper Signatures

### Picker
```swift
// Basic picker
Picker("Label", selection: $selection) {
    ForEach(options, id: \.self) { option in
        Text(option).tag(option)
    }
}
.pickerStyle(.segmented) // .menu, .wheel, .automatic

// CRITICAL: selection binding type MUST match tag() type exactly
// Int vs String mismatches cause silent failures
```

### Toggle
```swift
// Simple toggle
Toggle("Enable notifications", isOn: $isEnabled)

// Custom label
Toggle(isOn: $isEnabled) {
    HStack {
        Image(systemName: "bell")
        Text("Notifications")
    }
}
```

### Stepper
```swift
// With range and step
Stepper("Count: \(count)", value: $count, in: 0...100, step: 5)

// Manual control
Stepper(onIncrement: {
    count = min(count + 1, 100)
}, onDecrement: {
    count = max(count - 1, 0)
}) {
    Text("Count: \(count)")
}
```

## Focus Management & Keyboard

### Focus State (iOS 15+)
```swift
@FocusState private var focusedField: Field?

enum Field: CaseIterable {
    case username, email, password
}

TextField("Username", text: $username)
    .focused($focusedField, equals: .username)
    .onSubmit {
        focusedField = .email // Auto-advance focus
    }

// CRITICAL: focusedField must be Optional enum for multi-field forms
// Non-optional bindings cause focus management failures
```

### Keyboard Types
```swift
TextField("Email", text: $email)
    .keyboardType(.emailAddress)
    .textContentType(.emailAddress)
    .autocapitalization(.none)

// Available types: .default, .asciiCapable, .numbersAndPunctuation,
// .URL, .numberPad, .phonePad, .namePhonePad, .emailAddress,
// .decimalPad, .twitter, .webSearch, .asciiCapableNumberPad
```

### Focus Effect Control
```swift
// Disable default focus ring (macOS/tvOS)
TextField("Custom focus", text: $text)
    .focusEffectDisabled()

// Monitor focus state
TextField("Monitored", text: $text)
    .focused($isFocused)
    .overlay(
        RoundedRectangle(cornerRadius: 4)
            .stroke(isFocused ? Color.blue : Color.gray)
    )
```

## Binding Patterns & Validation

### Real-time Validation
```swift
struct ValidatorModifier: ViewModifier {
    let value: String
    let rule: (String) -> String?
    @State private var errorMessage: String?

    func body(content: Content) -> some View {
        VStack(alignment: .leading) {
            content
            if let errorMessage = errorMessage {
                Text(errorMessage)
                    .foregroundColor(.red)
                    .font(.caption)
            }
        }
        .onChange(of: value) { newValue in
            errorMessage = rule(newValue)
        }
    }
}

// Usage
TextField("Email", text: $email)
    .modifier(ValidatorModifier(value: email) { email in
        email.contains("@") ? nil : "Invalid email"
    })
```

### Form Submission Validation
```swift
// iOS 17+ @Observable pattern
@Observable
class FormViewModel {
    var username = ""
    var email = ""
    var errors: [String: String] = [:]

    func validate() -> Bool {
        errors.removeAll()
        if username.isEmpty {
            errors["username"] = "Required"
        }
        return errors.isEmpty
    }
}
```

## Non-Obvious Behaviors & Gotchas

### iOS 17 Memory Leak Issues
- **CRITICAL BUG**: TextField in sheets/fullScreenCover causes memory leaks in iOS 17
- ObservableObject view models leak when presenting sheets with TextField
- Workaround: Use @Observable over ObservableObject where possible
- Bug does NOT occur in iOS 16, specific to iOS 17

### Binding Performance Issues
```swift
// BAD: Creates new binding on every view update
TextField("Bad", text: Binding(
    get: { viewModel.text },
    set: { viewModel.text = $0 }
))

// GOOD: Direct state binding
TextField("Good", text: $viewModel.text)
```

### Focus State Timing Issues
```swift
// WRONG: Immediate focus change fails
Button("Focus email") {
    focusedField = .email // May not work
}

// CORRECT: Delayed focus change
Button("Focus email") {
    DispatchQueue.main.async {
        focusedField = .email
    }
}
```

### Form Rendering Context
- Forms under NavigationView change picker presentation style
- List vs Form affects control spacing and grouping
- Form automatically adds disclosure indicators to navigation-style pickers

### Picker Selection Type Matching
```swift
// CRITICAL: These types must match exactly
@State private var selection: String = ""

Picker("Options", selection: $selection) {
    Text("Option 1").tag("option1") // String tag
    Text("Option 2").tag("option2") // String tag
}

// Int selection with String tags = silent failure
// Optional vs non-optional mismatches cause crashes
```

## Version Requirements

- **Focus State**: iOS 15.0+, macOS 12.0+
- **TextField axis/lineLimit**: iOS 16.0+, macOS 13.0+
- **Text Input Suggestions**: iOS 18.0+, macOS 15.0+
- **submitScope**: iOS 15.0+, macOS 12.0+
- **focusEffectDisabled**: iOS 17.0+, macOS 14.0+
- **@Observable**: iOS 17.0+, macOS 14.0+

### iOS 18 New Features
- Programmatic text selection control in TextField
- textInputSuggestions and textInputCompletion modifiers
- Enhanced sheet presentation sizing with .presentationSizing
- Improved Swift 6 concurrency with @MainActor isolation

## Critical Form Setup
```swift
// Complete form template with proper patterns
struct FormView: View {
    @State private var viewModel = FormViewModel()
    @FocusState private var focusedField: Field?

    var body: some View {
        NavigationView {
            Form {
                Section("Account") {
                    TextField("Username", text: $viewModel.username)
                        .focused($focusedField, equals: .username)
                        .textContentType(.username)
                        .autocapitalization(.none)
                        .onSubmit { focusedField = .email }

                    TextField("Email", text: $viewModel.email)
                        .focused($focusedField, equals: .email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .autocapitalization(.none)
                        .onSubmit { focusedField = .password }

                    SecureField("Password", text: $viewModel.password)
                        .focused($focusedField, equals: .password)
                        .textContentType(.newPassword)
                }

                Section {
                    Button("Submit") {
                        if viewModel.validate() {
                            submitForm()
                        }
                    }
                    .disabled(!viewModel.isValid)
                }
            }
            .navigationTitle("Register")
        }
    }
}
```