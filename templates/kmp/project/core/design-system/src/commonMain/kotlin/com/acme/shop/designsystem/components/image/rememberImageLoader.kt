package com.acme.shop.designsystem.components.image

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import coil3.ImageLoader
import coil3.compose.LocalPlatformContext

@Composable
fun rememberImageLoader(): ImageLoader {
    val context = LocalPlatformContext.current

    return remember {
        ImageLoader.Builder(context)
            .build()
    }
}
