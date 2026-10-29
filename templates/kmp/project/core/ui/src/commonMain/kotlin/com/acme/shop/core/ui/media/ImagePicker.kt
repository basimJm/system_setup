package com.acme.shop.core.ui.media

/** Where takes the profile photo from. */
enum class ImageSource { CAMERA, GALLERY }

/** Device-compressed image bytes ready for a presigned upload. */
class PickedImage(val bytes: ByteArray, val contentType: String)

/** What the picker produced; only [Picked] carries bytes, the rest tell the screen what to say. */
sealed interface PickResult {
    data class Picked(val image: PickedImage) : PickResult

    /** The customer closed the picker / camera without choosing. */
    data object Cancelled : PickResult

    /** No camera on this device (iOS simulator, camera-less tablets) or no camera app to take the photo. */
    data object CameraUnavailable : PickResult

    /** The chosen file could not be read or encoded. */
    data object Failed : PickResult
}

/** Platform picker port (Android Photo Picker / camera app, iOS PHPicker / camera). Never throws. */
interface ImagePicker {
    suspend fun pick(source: ImageSource): PickResult
}

object ImagePickerDefaults {
    const val JPEG_CONTENT_TYPE = "image/jpeg"
    const val MAX_DIMENSION_PX = 1024
    const val JPEG_QUALITY = 85
    const val PERCENT = 100.0
}

/** Size math shared by both platforms (pure, unit-tested). */
object ImageScaling {
    /** The size that fits [maxDimension] on the longer side, keeping the aspect ratio; never upscales. */
    fun fit(width: Int, height: Int, maxDimension: Int = ImagePickerDefaults.MAX_DIMENSION_PX): Pair<Int, Int> {
        val longer = maxOf(width, height)
        if (width <= 0 || height <= 0 || longer <= maxDimension) return width to height
        val scale = maxDimension.toDouble() / longer
        return maxOf(1, (width * scale).toInt()) to maxOf(1, (height * scale).toInt())
    }

    /**
     * Largest power-of-two decoder subsample that keeps the longer side ≥ [maxDimension], so a 48 MP photo is never
     * decoded at full size (out-of-memory on small devices) and the final resize still has enough pixels.
     */
    fun sampleSize(width: Int, height: Int, maxDimension: Int = ImagePickerDefaults.MAX_DIMENSION_PX): Int {
        var sample = 1
        val longer = maxOf(width, height)
        while (longer / (sample * SUBSAMPLE_STEP) >= maxDimension) sample *= SUBSAMPLE_STEP
        return sample
    }

    /** Decoders only subsample by powers of two. */
    private const val SUBSAMPLE_STEP = 2
}

class FakeImagePicker(var result: PickResult = PickResult.Cancelled) : ImagePicker {
    val requests = mutableListOf<ImageSource>()
    override suspend fun pick(source: ImageSource): PickResult {
        requests += source
        return result
    }
}
