import AVFoundation

class RealTalkAudio {
  static let shared = RealTalkAudio()

  private var engine: AVAudioEngine?
  private var playerNode: AVAudioPlayerNode?
  private var onMicData: ((Data) -> Void)?

  private let targetSampleRate: Double = 16000
  private let targetChannels: AVAudioChannelCount = 1

  private init() {}

  func initialize() throws {
    tearDown()

    let session = AVAudioSession.sharedInstance()
    try session.setCategory(
      .playAndRecord,
      mode: .voiceChat,
      options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP]
    )
    try session.setPreferredIOBufferDuration(0.005)
    try session.setActive(true)

    let engine = AVAudioEngine()
    let playerNode = AVAudioPlayerNode()
    engine.attach(playerNode)

    let inputNode = engine.inputNode

    if #available(iOS 13.0, *) {
      try inputNode.setVoiceProcessingEnabled(true)
    }

    let outputFormat = AVAudioFormat(
      standardFormatWithSampleRate: targetSampleRate,
      channels: targetChannels
    )!

    engine.connect(playerNode, to: engine.mainMixerNode, format: outputFormat)
    engine.prepare()
    try engine.start()

    self.engine = engine
    self.playerNode = playerNode

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleConfigurationChange),
      name: .AVAudioEngineConfigurationChange,
      object: engine
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleInterruption),
      name: AVAudioSession.interruptionNotification,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleMediaServicesReset),
      name: AVAudioSession.mediaServicesWereResetNotification,
      object: nil
    )
  }

  func startRecording() throws {
    guard let engine = engine else { return }

    let inputNode = engine.inputNode
    let hardwareFormat = inputNode.outputFormat(forBus: 0)

    let targetFormat = AVAudioFormat(
      commonFormat: .pcmFormatInt16,
      sampleRate: targetSampleRate,
      channels: targetChannels,
      interleaved: true
    )!

    let converter = AVAudioConverter(from: hardwareFormat, to: targetFormat)!

    inputNode.installTap(onBus: 0, bufferSize: 1024, format: hardwareFormat) {
      [weak self] buffer, _ in
      guard let self = self else { return }

      let frameCapacity = AVAudioFrameCount(
        Double(buffer.frameLength) * self.targetSampleRate / hardwareFormat.sampleRate
      )
      guard let convertedBuffer = AVAudioPCMBuffer(
        pcmFormat: targetFormat,
        frameCapacity: frameCapacity
      ) else { return }

      var error: NSError?
      converter.convert(to: convertedBuffer, error: &error) { _, outStatus in
        outStatus.pointee = .haveData
        return buffer
      }

      if error != nil { return }

      guard let int16Ptr = convertedBuffer.int16ChannelData else { return }
      let data = Data(
        bytes: int16Ptr[0],
        count: Int(convertedBuffer.frameLength) * MemoryLayout<Int16>.size
      )
      self.onMicData?(data)
    }
  }

  func stopRecording() {
    engine?.inputNode.removeTap(onBus: 0)
  }

  func playAudio(_ data: Data) {
    guard let engine = engine, let playerNode = playerNode else { return }

    let sampleCount = data.count / MemoryLayout<Int16>.size
    guard sampleCount > 0 else { return }

    let format = AVAudioFormat(
      commonFormat: .pcmFormatFloat32,
      sampleRate: targetSampleRate,
      channels: targetChannels,
      interleaved: false
    )!

    guard let buffer = AVAudioPCMBuffer(
      pcmFormat: format,
      frameCapacity: AVAudioFrameCount(sampleCount)
    ) else { return }
    buffer.frameLength = AVAudioFrameCount(sampleCount)

    let floatPtr = buffer.floatChannelData![0]
    data.withUnsafeBytes { raw in
      let int16Ptr = raw.bindMemory(to: Int16.self)
      for i in 0..<sampleCount {
        floatPtr[i] = Float(int16Ptr[i]) / 32768.0
      }
    }

    if !engine.isRunning {
      try? engine.start()
    }

    playerNode.scheduleBuffer(buffer)

    if !playerNode.isPlaying {
      playerNode.play()
    }
  }

  func stopPlayback() {
    playerNode?.stop()
    playerNode?.reset()
    playerNode?.play()
  }

  func setVolume(_ volume: Float) {
    playerNode?.volume = volume
  }

  func setMuted(_ muted: Bool) {
    guard let engine = engine else { return }
    if #available(iOS 17.0, *) {
      engine.inputNode.isVoiceProcessingInputMuted = muted
    }
  }

  func setOnMicData(_ callback: ((Data) -> Void)?) {
    onMicData = callback
  }

  func tearDown() {
    stopRecording()
    playerNode?.stop()
    engine?.stop()

    if let playerNode = playerNode {
      engine?.detach(playerNode)
    }

    NotificationCenter.default.removeObserver(self)

    engine = nil
    playerNode = nil
    onMicData = nil

    try? AVAudioSession.sharedInstance().setActive(false)
  }

  @objc private func handleConfigurationChange(_ notification: Notification) {
    guard let engine = engine else { return }
    if !engine.isRunning {
      engine.prepare()
      try? engine.start()
    }
  }

  @objc private func handleInterruption(_ notification: Notification) {
    guard let info = notification.userInfo,
          let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }

    if type == .ended {
      try? AVAudioSession.sharedInstance().setActive(true)
      if let engine = engine, !engine.isRunning {
        try? engine.start()
      }
    }
  }

  @objc private func handleMediaServicesReset(_ notification: Notification) {
    tearDown()
    try? initialize()
  }
}
