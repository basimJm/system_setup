package com.acme.shop.designsystem.components.media

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Inline video player with the platform's own controls (play / pause / seek, ).
 * Android wraps `VideoView` + `MediaController`, iOS wraps `AVPlayerViewController`; no third-party player.
 */
@Composable
expect fun AppVideoPlayer(url: String, modifier: Modifier = Modifier)
