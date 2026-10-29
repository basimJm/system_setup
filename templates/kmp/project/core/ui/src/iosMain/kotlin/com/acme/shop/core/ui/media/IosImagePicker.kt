package com.acme.shop.core.ui.media

import com.acme.shop.core.ui.external.IosSystem
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import platform.Foundation.NSData
import platform.Foundation.NSError
import platform.PhotosUI.PHPickerConfiguration
import platform.PhotosUI.PHPickerFilter
import platform.PhotosUI.PHPickerResult
import platform.PhotosUI.PHPickerViewController
import platform.PhotosUI.PHPickerViewControllerDelegateProtocol
import platform.UIKit.UIImage
import platform.UIKit.UIImagePickerController
import platform.UIKit.UIImagePickerControllerDelegateProtocol
import platform.UIKit.UIImagePickerControllerOriginalImage
import platform.UIKit.UIImagePickerControllerSourceType
import platform.UIKit.UINavigationControllerDelegateProtocol
import platform.UniformTypeIdentifiers.UTTypeImage
import platform.darwin.NSObject

/**
 * Gallery = PHPicker (out of process, no photo-library permission); camera = `UIImagePickerController` (needs
 * `NSCameraUsageDescription`; the simulator has no camera → [PickResult.CameraUnavailable]). Presented from the top
 * view controller. UIKit holds picker delegates weakly, so [activeDelegate] keeps the current one alive until it
 * answers (it used to be a local that Kotlin/Native could collect, leaving the picker without a callback).
 */
class IosImagePicker : ImagePicker {
    private var activeDelegate: NSObject? = null

    override suspend fun pick(source: ImageSource): PickResult = withContext(Dispatchers.Main) {
        when (source) {
            ImageSource.GALLERY -> pickFromLibrary()
            ImageSource.CAMERA -> takePhoto()
        }
    }

    private suspend fun pickFromLibrary(): PickResult {
        val top = IosSystem.topViewController() ?: return PickResult.Failed
        val answer = CompletableDeferred<NSData?>()
        val config = PHPickerConfiguration().apply {
            filter = PHPickerFilter.imagesFilter
            selectionLimit = 1
        }
        val picker = PHPickerViewController(configuration = config)
        val delegate = LibraryDelegate(answer)
        activeDelegate = delegate
        picker.delegate = delegate
        top.presentViewController(picker, animated = true, completion = null)
        val data = try {
            answer.await()
        } finally {
            activeDelegate = null
        }
        return when {
            delegate.cancelled -> PickResult.Cancelled
            data == null -> PickResult.Failed
            else -> encode(UIImage.imageWithData(data))
        }
    }

    private suspend fun takePhoto(): PickResult {
        val type = UIImagePickerControllerSourceType.UIImagePickerControllerSourceTypeCamera
        if (!UIImagePickerController.isSourceTypeAvailable(type)) return PickResult.CameraUnavailable
        val top = IosSystem.topViewController() ?: return PickResult.Failed
        val answer = CompletableDeferred<UIImage?>()
        val delegate = CameraDelegate(answer)
        val picker = UIImagePickerController().apply {
            sourceType = type
            this.delegate = delegate
        }
        activeDelegate = delegate
        top.presentViewController(picker, animated = true, completion = null)
        val image = try {
            answer.await()
        } finally {
            activeDelegate = null
        }
        picker.dismissViewControllerAnimated(true, completion = null)
        return image?.let { encode(it) } ?: PickResult.Cancelled
    }

    private suspend fun encode(image: UIImage?): PickResult = withContext(Dispatchers.Default) {
        image?.let(IosImageEncoder::encode)?.let { PickResult.Picked(it) } ?: PickResult.Failed
    }
}

private class LibraryDelegate(private val answer: CompletableDeferred<NSData?>) : NSObject(), PHPickerViewControllerDelegateProtocol {
    var cancelled = false

    override fun picker(picker: PHPickerViewController, didFinishPicking: List<*>) {
        // PHPicker never dismisses itself; close it now and load the bytes in the background.
        picker.dismissViewControllerAnimated(true, completion = null)
        val result = didFinishPicking.firstOrNull() as? PHPickerResult
        if (result == null) {
            cancelled = true
            answer.complete(null)
            return
        }
        @OptIn(ExperimentalForeignApi::class)
        val identifier = UTTypeImage.identifier
        result.itemProvider.loadDataRepresentationForTypeIdentifier(identifier) { data: NSData?, _: NSError? ->
            answer.complete(data)
        }
    }
}

private class CameraDelegate(private val answer: CompletableDeferred<UIImage?>) :
    NSObject(), UIImagePickerControllerDelegateProtocol, UINavigationControllerDelegateProtocol {

    override fun imagePickerController(picker: UIImagePickerController, didFinishPickingMediaWithInfo: Map<Any?, *>) {
        answer.complete(didFinishPickingMediaWithInfo[UIImagePickerControllerOriginalImage] as? UIImage)
    }

    override fun imagePickerControllerDidCancel(picker: UIImagePickerController) {
        answer.complete(null)
    }
}
