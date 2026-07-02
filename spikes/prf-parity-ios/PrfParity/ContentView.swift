// ContentView.swift
// Native reading for the PRF parity spike (SUR-655 / SUR-699).
//
// Runs an ASAuthorizationController assertion against the braird.app passkey
// enrolled by the web baseline (prf-test.html), attaching the iOS-18 PRF
// assertion input with saltInput1 = SHA-256("surfc-prf-eval-v1"), and prints
// the PRF output as lowercase hex. That hex MUST equal the web PRF hex
// (criterion 2). Then unwrap the prf-v1 blob off-device with these bytes
// (criterion 3).
//
// Shared constants — keep byte-identical to prf-test.html and to
// surfc/src/crypto/passkeyEnrollment.js + keyManager.js:
//   RP ID          : braird.app
//   PRF eval salt  : SHA-256(UTF8("surfc-prf-eval-v1"))  (32 bytes)

import SwiftUI
import AuthenticationServices
import CryptoKit

// MARK: - Shared constants

enum PrfConstants {
    static let rpID = "braird.app"
    static let prfEvalLabel = "surfc-prf-eval-v1"

    /// The PRF eval "first" salt — SHA-256 of the UTF-8 label. Identical bytes to
    /// getPrfSalt() in the web app and to prf-test.html.
    static var prfEvalSalt: Data {
        Data(SHA256.hash(data: Data(prfEvalLabel.utf8)))
    }
}

extension Data {
    /// Lowercase hex — the comparison format for criterion 2.
    var lowercaseHex: String {
        map { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - PRF assertion controller

@MainActor
final class PrfController: NSObject, ObservableObject {
    @Published var status: String = "Idle."
    @Published var prfHex: String = "—"
    @Published var isRunning: Bool = false

    let saltHex: String = PrfConstants.prfEvalSalt.lowercaseHex

    func runAssertion() {
        guard #available(iOS 18.0, *) else {
            status = "Requires iOS/iPadOS 18.0+ (PRF assertion API)."
            return
        }
        isRunning = true
        prfHex = "—"
        status = "Requesting assertion — approve the passkey prompt…"

        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
            relyingPartyIdentifier: PrfConstants.rpID
        )

        var challenge = Data(count: 32)
        challenge.withUnsafeMutableBytes { _ = SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!) }

        let request = provider.createCredentialAssertionRequest(challenge: challenge)

        // iOS 18 PRF assertion input: evaluate "first" with our fixed salt.
        let inputs = ASAuthorizationPublicKeyCredentialPRFAssertionInput.InputValues(
            saltInput1: PrfConstants.prfEvalSalt,
            saltInput2: nil
        )
        request.prf = ASAuthorizationPublicKeyCredentialPRFAssertionInput(
            inputValues: inputs,
            perCredentialInputValues: nil
        )

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()

        print("[prf-parity] salt (hex) = \(saltHex)")
    }
}

// MARK: - Delegate + presentation

extension PrfController: ASAuthorizationControllerDelegate {
    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        isRunning = false

        guard #available(iOS 18.0, *),
              let assertion = authorization.credential
                as? ASAuthorizationPlatformPublicKeyCredentialAssertion else {
            status = "Unexpected credential type: \(type(of: authorization.credential))"
            print("[prf-parity] \(status)")
            return
        }

        guard let prf = assertion.prf else {
            status = "Assertion succeeded but no PRF output. Confirm the passkey was enrolled "
                + "with PRF enabled (web create) and that this is iPadOS 18.x (past the early-18 PRF bug)."
            print("[prf-parity] \(status)")
            return
        }

        let first = prf.first
        let hex = first.lowercaseHex
        prfHex = hex
        status = "PRF read OK (\(first.count) bytes). Compare this hex to the web PRF hex."
        print("[prf-parity] NATIVE PRF first (hex) = \(hex)")
        if let second = prf.second {
            print("[prf-parity] NATIVE PRF second (hex) = \(second.lowercaseHex)")
        }
        print("[prf-parity] credentialID (hex) = \(assertion.credentialID.lowercaseHex)")
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        isRunning = false
        if let asError = error as? ASAuthorizationError {
            status = "Assertion failed: ASAuthorizationError.\(asError.code) — \(asError.localizedDescription)"
        } else {
            status = "Assertion failed: \(error.localizedDescription)"
        }
        print("[prf-parity] \(status)")
    }
}

extension PrfController: ASAuthorizationControllerPresentationContextProviding {
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive } ?? (UIApplication.shared.connectedScenes.first as? UIWindowScene)
        return scene?.keyWindow ?? ASPresentationAnchor()
    }
}

// MARK: - UI

struct ContentView: View {
    @StateObject private var controller = PrfController()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Native reading of the braird.app passkey PRF via AuthenticationServices. "
                        + "Enrol first in Safari with prf-test.html on this same device / iCloud account.")
                        .font(.callout)
                        .foregroundStyle(.secondary)

                    labelled("RP ID", PrfConstants.rpID)
                    labelled("PRF eval salt (hex)", controller.saltHex, mono: true)

                    Button {
                        controller.runAssertion()
                    } label: {
                        Text(controller.isRunning ? "Requesting…" : "Read PRF (assertion)")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(controller.isRunning)

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Native PRF output (hex)").font(.headline)
                        Text(controller.prfHex)
                            .font(.system(.footnote, design: .monospaced))
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                            .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Status").font(.headline)
                        Text(controller.status)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                    }
                }
                .padding()
            }
            .navigationTitle("PRF parity")
        }
    }

    @ViewBuilder
    private func labelled(_ key: String, _ value: String, mono: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(key).font(.caption).foregroundStyle(.secondary)
            Text(value)
                .font(mono ? .system(.footnote, design: .monospaced) : .footnote)
                .textSelection(.enabled)
        }
    }
}

#Preview {
    ContentView()
}
