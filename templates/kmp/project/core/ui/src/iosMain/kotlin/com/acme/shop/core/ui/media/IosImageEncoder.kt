package com.acme.shop.core.ui.media

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.useContents
import kotlinx.cinterop.usePinned
import platform.CoreGraphics.CGRectMake
import platform.CoreGraphics.CGSizeMake
import platform.Foundation.NSData
import platform.UIKit.UIGraphicsImageRenderer
import platform.UIKit.UIGraphicsImageRendererFormat
import platform.UIKit.UIImage
import platform.UIKit.UIImageJPEGRepresentation
import platform.posix.memcpy

/**
 * Any picked image → upright JPEG with the longer side ≤ [ImagePickerDefaults.MAX_DIMENSION_PX].
 * Always redrawn at scale 1, so the camera's `imageOrientation` is baked into the pixels (a raw JPEG would keep
 * the EXIF flag, which some viewers ignore) and HEIC library photos become JPEG.
 */
@OptIn(ExperimentalForeignApi::class)
internal object IosImageEncoder {

    fun encode(image: UIImage): PickedImage? {
        val (sourceWidth, sourceHeight) = image.size.useContents { width to height }
        val (width, height) = ImageScaling.fit(sourceWidth.toInt(), sourceHeight.toInt())
        if (width <= 0 || height <= 0) return null
        val format = UIGraphicsImageRendererFormat.defaultFormat().apply { scale = 1.0 }
        val renderer = UIGraphicsImageRenderer(size = CGSizeMake(width.toDouble(), height.toDouble()), format = format)
        val upright = renderer.imageWithActions { _ ->
            image.drawInRect(CGRectMake(0.0, 0.0, width.toDouble(), height.toDouble()))
        }
        val data = UIImageJPEGRepresentation(upright, ImagePickerDefaults.JPEG_QUALITY / ImagePickerDefaults.PERCENT) ?: return null
        return PickedImage(data.toByteArray(), ImagePickerDefaults.JPEG_CONTENT_TYPE)
    }

    private fun NSData.toByteArray(): ByteArray {
        val size = length.toInt()
        if (size == 0) return ByteArray(0)
        return ByteArray(size).apply { usePinned { memcpy(it.addressOf(0), bytes, length) } }
    }
}
