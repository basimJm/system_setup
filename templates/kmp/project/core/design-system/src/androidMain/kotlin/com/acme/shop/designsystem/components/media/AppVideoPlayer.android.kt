package com.acme.shop.designsystem.components.media

import android.widget.MediaController
import android.widget.VideoView
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.net.toUri

@Composable
actual fun AppVideoPlayer(url: String, modifier: Modifier) {
    val context = LocalContext.current
    val videoView = remember(context) { VideoView(context) }
    DisposableEffect(videoView) {
        onDispose { videoView.stopPlayback() }
    }
    AndroidView(
        factory = {
            videoView.apply {
                setMediaController(MediaController(context).also { it.setAnchorView(this) })
                setOnPreparedListener { it.start() }
            }
        },
        update = { view -> view.setVideoURI(url.toUri()) },
        modifier = modifier,
    )
}
