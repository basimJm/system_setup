package com.acme.shop.core.ui.media

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import java.io.File
import java.io.IOException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Activity-bound launchers (attached by MainActivity like the permission bridge); one request at a time.
 * Gallery = system Photo Picker (no storage permission); camera = the camera app writing a full-size photo into
 * a FileProvider URI (`TakePicture`; the old `TakePicturePreview` only returned a thumbnail).
 */
class AndroidImagePickerBridge {
    private var gallery: ActivityResultLauncher<PickVisualMediaRequest>? = null
    private var camera: ActivityResultLauncher<Uri>? = null
    private var pendingGallery: CompletableDeferred<Uri?>? = null
    private var pendingCamera: CompletableDeferred<Boolean>? = null

    fun attach(activity: ComponentActivity) {
        gallery = activity.registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
            pendingGallery?.complete(uri)
            pendingGallery = null
        }
        camera = activity.registerForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
            pendingCamera?.complete(saved)
            pendingCamera = null
        }
    }

    /** A recreated Activity registers again under the same keys and receives the result; only finishing cancels. */
    fun detach(finishing: Boolean) {
        gallery?.unregister()
        camera?.unregister()
        gallery = null
        camera = null
        if (finishing) {
            pendingGallery?.cancel()
            pendingCamera?.cancel()
            pendingGallery = null
            pendingCamera = null
        }
    }

    suspend fun pickFromGallery(): Uri? {
        val launcher = gallery ?: return null
        val answer = CompletableDeferred<Uri?>()
        pendingGallery = answer
        launcher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        return answer.await()
    }

    /** True when the camera app saved a photo into [target]; throws [ActivityNotFoundException] without a camera app. */
    suspend fun takePicture(target: Uri): Boolean {
        val launcher = camera ?: return false
        val answer = CompletableDeferred<Boolean>()
        pendingCamera = answer
        try {
            launcher.launch(target)
        } catch (error: ActivityNotFoundException) {
            pendingCamera = null
            throw error
        }
        return answer.await()
    }
}

class AndroidImagePicker(
    private val context: Context,
    private val bridge: AndroidImagePickerBridge,
) : ImagePicker {

    override suspend fun pick(source: ImageSource): PickResult = when (source) {
        ImageSource.GALLERY -> bridge.pickFromGallery()?.let { encode(it) } ?: PickResult.Cancelled
        ImageSource.CAMERA -> capture()
    }

    private suspend fun capture(): PickResult {
        if (!context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) return PickResult.CameraUnavailable
        val file = withContext(Dispatchers.IO) { photoFile() } ?: return PickResult.Failed
        val uri = FileProvider.getUriForFile(context, context.packageName + CameraFiles.AUTHORITY_SUFFIX, file)
        return try {
            if (bridge.takePicture(uri)) encode(uri) else PickResult.Cancelled
        } catch (ignored: ActivityNotFoundException) {
            PickResult.CameraUnavailable
        } finally {
            withContext(Dispatchers.IO) { file.delete() }
        }
    }

    private fun photoFile(): File? = try {
        val dir = File(context.cacheDir, CameraFiles.DIRECTORY).apply { mkdirs() }
        File.createTempFile(CameraFiles.PREFIX, CameraFiles.SUFFIX, dir)
    } catch (ignored: IOException) {
        null
    }

    private suspend fun encode(uri: Uri): PickResult = withContext(Dispatchers.IO) {
        AndroidImageEncoder.encode(context.contentResolver, uri)?.let { PickResult.Picked(it) } ?: PickResult.Failed
    }
}

/** Must match the `<provider>` authority and `res/xml/file_paths.xml` of the app manifest. */
object CameraFiles {
    const val AUTHORITY_SUFFIX = ".fileprovider"
    const val DIRECTORY = "camera"
    const val PREFIX = "photo_"
    const val SUFFIX = ".jpg"
}
