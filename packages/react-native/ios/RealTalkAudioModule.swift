import Foundation
import React

@objc(RealTalkAudio)
class RealTalkAudioModule: RCTEventEmitter {
  private var hasListeners = false

  override static func moduleName() -> String! {
    return "RealTalkAudio"
  }

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return ["onMicrophoneData"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  @objc func initialize(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      try RealTalkAudio.shared.initialize()
      resolve(nil)
    } catch {
      reject("INIT_ERROR", error.localizedDescription, error)
    }
  }

  @objc func startRecording(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    RealTalkAudio.shared.setOnMicData { [weak self] data in
      guard let self = self, self.hasListeners else { return }
      self.sendEvent(withName: "onMicrophoneData", body: ["data": data.base64EncodedString()])
    }

    do {
      try RealTalkAudio.shared.startRecording()
      resolve(nil)
    } catch {
      reject("RECORDING_ERROR", error.localizedDescription, error)
    }
  }

  @objc func stopRecording(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    RealTalkAudio.shared.stopRecording()
    resolve(nil)
  }

  @objc func playAudio(
    _ base64Data: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let data = Data(base64Encoded: base64Data) else {
      reject("INVALID_DATA", "Invalid base64 audio data", nil)
      return
    }
    RealTalkAudio.shared.playAudio(data)
    resolve(nil)
  }

  @objc func stopPlayback(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    RealTalkAudio.shared.stopPlayback()
    resolve(nil)
  }

  @objc func setVolume(
    _ volume: Float,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    RealTalkAudio.shared.setVolume(volume)
    resolve(nil)
  }

  @objc func setMuted(
    _ muted: Bool,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    RealTalkAudio.shared.setMuted(muted)
    resolve(nil)
  }

  @objc func tearDown(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    RealTalkAudio.shared.tearDown()
    resolve(nil)
  }
}
