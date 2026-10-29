package com.acme.shop.core.ui.media

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayOutputStream
import java.io.IOException

/**
 * Picked file → upright JPEG whose longer side is at most [ImagePickerDefaults.MAX_DIMENSION_PX] (device
 * compression). Decodes subsampled (no out-of-memory on 48 MP photos) and applies the EXIF rotation, which camera
 * apps record instead of rotating pixels. Null when the file cannot be read.
 */
internal object AndroidImageEncoder {

    fun encode(resolver: ContentResolver, uri: Uri): PickedImage? = try {
        decode(resolver, uri)?.let { bitmap ->
            val upright = rotate(bitmap, rotationOf(resolver, uri))
            val (width, height) = ImageScaling.fit(upright.width, upright.height)
            val scaled = if (width != upright.width) Bitmap.createScaledBitmap(upright, width, height, true) else upright
            val out = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.JPEG, ImagePickerDefaults.JPEG_QUALITY, out)
            PickedImage(out.toByteArray(), ImagePickerDefaults.JPEG_CONTENT_TYPE)
        }
    } catch (ignored: IOException) {
        null
    } catch (ignored: SecurityException) {
        null
    }

    private fun decode(resolver: ContentResolver, uri: Uri): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        val options = BitmapFactory.Options().apply { inSampleSize = ImageScaling.sampleSize(bounds.outWidth, bounds.outHeight) }
        return resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
    }

    private fun rotationOf(resolver: ContentResolver, uri: Uri): Float {
        val orientation = resolver.openInputStream(uri)?.use {
            ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
        } ?: ExifInterface.ORIENTATION_NORMAL
        return when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> QUARTER_TURN
            ExifInterface.ORIENTATION_ROTATE_180 -> HALF_TURN
            ExifInterface.ORIENTATION_ROTATE_270 -> THREE_QUARTER_TURN
            else -> 0f
        }
    }

    private fun rotate(bitmap: Bitmap, degrees: Float): Bitmap {
        if (degrees == 0f) return bitmap
        val matrix = Matrix().apply { postRotate(degrees) }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    private const val QUARTER_TURN = 90f
    private const val HALF_TURN = 180f
    private const val THREE_QUARTER_TURN = 270f
}
