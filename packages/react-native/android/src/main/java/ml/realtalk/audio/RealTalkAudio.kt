package ml.realtalk.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.util.Log
import java.util.concurrent.Executors
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.atomic.AtomicBoolean

class RealTalkAudio(private val context: Context) {
  companion object {
    private const val TAG = "RealTalkAudio"
    private const val SAMPLE_RATE = 16000
    private const val CHANNEL_IN = AudioFormat.CHANNEL_IN_MONO
    private const val CHANNEL_OUT = AudioFormat.CHANNEL_OUT_MONO
    private const val ENCODING = AudioFormat.ENCODING_PCM_16BIT
    private val POISON_PILL = ByteArray(0)
  }

  private var audioRecord: AudioRecord? = null
  private var audioTrack: AudioTrack? = null
  private var echoCanceler: AcousticEchoCanceler? = null
  private var noiseSuppressor: NoiseSuppressor? = null
  private var audioManager: AudioManager? = null
  private var previousAudioMode: Int = AudioManager.MODE_NORMAL

  private val isRecording = AtomicBoolean(false)
  private val micExecutor = Executors.newFixedThreadPool(1)

  private val playbackQueue = LinkedBlockingQueue<ByteArray>()
  private var playbackThread: Thread? = null
  private val isPlaybackRunning = AtomicBoolean(false)

  private var onMicData: ((ByteArray) -> Unit)? = null

  fun initialize() {
    tearDown()

    audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    previousAudioMode = audioManager!!.mode
    audioManager!!.mode = AudioManager.MODE_IN_COMMUNICATION
    audioManager!!.isSpeakerphoneOn = true

    val minRecordBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_IN, ENCODING)
    val record = AudioRecord(
      MediaRecorder.AudioSource.VOICE_COMMUNICATION,
      SAMPLE_RATE,
      CHANNEL_IN,
      ENCODING,
      minRecordBuf
    )

    if (record.state != AudioRecord.STATE_INITIALIZED) {
      record.release()
      throw IllegalStateException("AudioRecord failed to initialize. Check RECORD_AUDIO permission.")
    }

    audioRecord = record

    if (AcousticEchoCanceler.isAvailable()) {
      echoCanceler = AcousticEchoCanceler.create(record.audioSessionId)
      echoCanceler?.enabled = true
    }
    if (NoiseSuppressor.isAvailable()) {
      noiseSuppressor = NoiseSuppressor.create(record.audioSessionId)
      noiseSuppressor?.enabled = true
    }

    val minPlayBuf = AudioTrack.getMinBufferSize(SAMPLE_RATE, CHANNEL_OUT, ENCODING)
    audioTrack = AudioTrack(
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build(),
      AudioFormat.Builder()
        .setEncoding(ENCODING)
        .setSampleRate(SAMPLE_RATE)
        .setChannelMask(CHANNEL_OUT)
        .build(),
      minPlayBuf,
      AudioTrack.MODE_STREAM,
      record.audioSessionId
    )

    audioTrack!!.play()
    startPlaybackThread()
  }

  fun startRecording() {
    if (isRecording.get()) return

    audioRecord?.startRecording()
    isRecording.set(true)

    Log.d(TAG, "Recording started")

    micExecutor.execute {
      val buffer = ByteArray(1024)
      var readCount = 0

      while (isRecording.get()) {
        val read = audioRecord?.read(buffer, 0, buffer.size) ?: -1
        if (read > 0) {
          readCount++
          val data = buffer.copyOf(read)
          if (readCount <= 5 || readCount % 100 == 0) {
            Log.d(TAG, "Mic read #$readCount: $read bytes")
          }
          onMicData?.invoke(data)
        } else if (read < 0) {
          Log.w(TAG, "AudioRecord.read error: $read")
        }
      }

      Log.d(TAG, "Recording stopped after $readCount reads")
    }
  }

  fun stopRecording() {
    isRecording.set(false)
    try {
      audioRecord?.stop()
    } catch (_: Exception) {}
  }

  private fun startPlaybackThread() {
    isPlaybackRunning.set(true)
    playbackThread = Thread({
      android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_AUDIO)
      while (isPlaybackRunning.get()) {
        try {
          val chunk = playbackQueue.take()
          if (chunk === POISON_PILL) break
          audioTrack?.write(chunk, 0, chunk.size)
        } catch (_: InterruptedException) {
          break
        }
      }
    }, "RealTalkPlayback")
    playbackThread!!.start()
  }

  fun playAudio(data: ByteArray) {
    playbackQueue.offer(data)
  }

  fun stopPlayback() {
    playbackQueue.clear()
    audioTrack?.pause()
    audioTrack?.flush()
    audioTrack?.play()
  }

  fun setVolume(volume: Float) {
    audioTrack?.setVolume(volume)
  }

  fun setMuted(muted: Boolean) {}

  fun setOnMicData(callback: ((ByteArray) -> Unit)?) {
    onMicData = callback
  }

  fun tearDown() {
    stopRecording()

    isPlaybackRunning.set(false)
    playbackQueue.offer(POISON_PILL)
    playbackThread?.join(1000)
    playbackThread = null

    echoCanceler?.release()
    echoCanceler = null
    noiseSuppressor?.release()
    noiseSuppressor = null

    audioRecord?.release()
    audioRecord = null

    playbackQueue.clear()
    try {
      audioTrack?.stop()
    } catch (_: Exception) {}
    audioTrack?.release()
    audioTrack = null

    audioManager?.let {
      it.isSpeakerphoneOn = false
      it.mode = previousAudioMode
    }
    audioManager = null

    onMicData = null
  }
}
