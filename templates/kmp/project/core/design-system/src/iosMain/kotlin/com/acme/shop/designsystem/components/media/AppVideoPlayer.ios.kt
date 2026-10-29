package com.acme.shop.designsystem.components.media

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.UIKitView
import kotlinx.cinterop.ExperimentalForeignApi
import platform.AVFoundation.AVPlayer
import platform.AVFoundation.pause
import platform.AVFoundation.play
import platform.AVKit.AVPlayerViewController
import platform.Foundation.NSURL

@OptIn(ExperimentalForeignApi::class)
@Composable
actual fun AppVideoPlayer(url: String, modifier: Modifier) {
    val player = remember(url) { AVPlayer(uRL = NSURL(string = url)) }
    val controller = remember(player) { AVPlayerViewController().apply { this.player = player } }
    DisposableEffect(player) {
        player.play()
        onDispose { player.pause() }
    }
    UIKitView(factory = { controller.view }, modifier = modifier)
}
