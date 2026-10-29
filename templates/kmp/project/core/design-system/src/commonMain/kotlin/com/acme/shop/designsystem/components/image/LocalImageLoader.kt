package com.acme.shop.designsystem.components.image

import androidx.compose.runtime.staticCompositionLocalOf
import coil3.ImageLoader

val LocalImageLoader = staticCompositionLocalOf<ImageLoader> {
    error("No ImageLoader provided")
}
