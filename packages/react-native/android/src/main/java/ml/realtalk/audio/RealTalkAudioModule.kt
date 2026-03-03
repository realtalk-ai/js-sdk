package ml.realtalk.audio

import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class RealTalkAudioModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var audio: RealTalkAudio? = null

  override fun getName(): String = "RealTalkAudio"

  @ReactMethod
  fun initialize(promise: Promise) {
    try {
      val instance = RealTalkAudio(reactApplicationContext)
      instance.initialize()
      audio = instance
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("INIT_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun startRecording(promise: Promise) {
    try {
      audio?.setOnMicData { data ->
        val params = Arguments.createMap()
        params.putString("data", Base64.encodeToString(data, Base64.NO_WRAP))
        reactApplicationContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("onMicrophoneData", params)
      }
      audio?.startRecording()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("RECORDING_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun stopRecording(promise: Promise) {
    audio?.stopRecording()
    promise.resolve(null)
  }

  @ReactMethod
  fun playAudio(base64Data: String, promise: Promise) {
    try {
      val data = Base64.decode(base64Data, Base64.NO_WRAP)
      audio?.playAudio(data)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("PLAY_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun stopPlayback(promise: Promise) {
    audio?.stopPlayback()
    promise.resolve(null)
  }

  @ReactMethod
  fun setVolume(volume: Float, promise: Promise) {
    audio?.setVolume(volume)
    promise.resolve(null)
  }

  @ReactMethod
  fun setMuted(muted: Boolean, promise: Promise) {
    audio?.setMuted(muted)
    promise.resolve(null)
  }

  @ReactMethod
  fun tearDown(promise: Promise) {
    audio?.tearDown()
    audio = null
    promise.resolve(null)
  }

  @ReactMethod
  fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}

  @ReactMethod
  fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Int) {}
}
