// PrfParityApp.swift
// Throwaway spike harness — SUR-655 / SUR-699 (iOS PRF parity).
// Proves native iOS AuthenticationServices returns the SAME WebAuthn-PRF bytes
// as Safari/WebKit for the same braird.app passkey + the same eval salt.
// NOT production code. Do not ship.

import SwiftUI

@main
struct PrfParityApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
